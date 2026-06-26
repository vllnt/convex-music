/**
 * Resilient provider HTTP. Wraps `fetch` with a per-request timeout and retries
 * on rate-limit (429) **and** overload 5xx (500/502/503/504/529) — honoring
 * `Retry-After`, capped exponential backoff, and jitter. songtrivia retries only
 * 429; a Spotify/Apple `529`/`503` must never hard-fail an import, so the
 * component also retries transient overload. Every knob is config; the timer and
 * RNG are injectable so the retry loop is deterministic under test.
 */

/** Status codes worth retrying: rate-limit + transient overload. */
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
  429, 500, 502, 503, 504, 529,
]);

/** Tunable retry/timeout policy for a provider call. */
export interface RetryConfig {
  /** Max total attempts before giving up. */
  maxAttempts: number;
  /** Upper bound on any single backoff wait, in ms. */
  maxWaitMs: number;
  /** Random jitter added to each wait, in ms (`0..jitterMs`). */
  jitterMs: number;
  /** Per-request timeout before aborting, in ms. */
  timeoutMs: number;
}

/** songtrivia-derived defaults (all overridable via mount policy). */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 6,
  maxWaitMs: 60_000,
  jitterMs: 250,
  timeoutMs: 15_000,
};

/** Injectable side-effects so the retry loop is deterministic under test. */
export interface FetchDeps {
  /** The `fetch` implementation to call. */
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  /** Sleep helper for backoff waits. */
  sleep: (ms: number) => Promise<void>;
  /** RNG in `[0, 1)` for jitter. */
  random: () => number;
}

/** Default deps bound to the runtime's real `fetch`, timer, and RNG. */
export const defaultFetchDeps: FetchDeps = {
  fetch: (url, init) => globalThis.fetch(url, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random: () => Math.random(),
};

/** A non-2xx provider response that is non-retryable or survived all retries. */
export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly provider: string,
  ) {
    super(`${provider} API error ${status}: ${body.slice(0, 256)}`);
    this.name = "ProviderHttpError";
  }
}

/** A request that exceeded the per-attempt timeout (retried like an overload). */
export class ProviderTimeoutError extends Error {
  constructor(
    readonly provider: string,
    readonly timeoutMs: number,
  ) {
    super(`${provider} API timeout after ${timeoutMs}ms`);
    this.name = "ProviderTimeoutError";
  }
}

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) to ms, or undefined. */
function parseRetryAfterMs(
  header: string | null,
  now: number,
): number | undefined {
  if (header === null) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return Math.max(0, Math.floor(seconds * 1000));
  const dateMs = Date.parse(header);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - now);
}

/** Capped exponential backoff for a 1-based attempt, before jitter. */
function backoffMs(attempt: number, cfg: RetryConfig): number {
  return Math.min(cfg.maxWaitMs, 2 ** (attempt - 1) * 1000);
}

/** Wait for a retryable attempt: `Retry-After` (or backoff) + jitter, capped. */
function nextWaitMs(
  retryAfterMs: number | undefined,
  attempt: number,
  cfg: RetryConfig,
  deps: FetchDeps,
): number {
  const base = retryAfterMs ?? backoffMs(attempt, cfg);
  const jitter = Math.floor(deps.random() * cfg.jitterMs);
  return Math.min(cfg.maxWaitMs, base + jitter);
}

/**
 * Fetch JSON from a provider with timeout + bounded retries. Resolves the parsed
 * body on a 2xx; throws {@link ProviderHttpError} on a non-retryable or
 * retry-exhausted response, or {@link ProviderTimeoutError} if every attempt
 * timed out.
 *
 * @param provider - provider id, for error messages.
 * @param url - the absolute request URL (query already encoded).
 * @param init - fetch init (headers, method); `signal` is managed internally.
 * @param cfg - retry/timeout policy.
 * @param deps - injectable fetch/sleep/random (defaults to the runtime).
 */
export async function fetchJson<T>(
  provider: string,
  url: string,
  init: RequestInit = {},
  cfg: RetryConfig = DEFAULT_RETRY_CONFIG,
  deps: FetchDeps = defaultFetchDeps,
): Promise<T> {
  let attempt = 0;
  while (true) {
    attempt += 1;
    const isLast = attempt >= cfg.maxAttempts;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);
    let res: Response;
    let body: string;
    try {
      res = await deps.fetch(url, { ...init, signal: controller.signal });
      if (res.ok) {
        return (await res.json()) as T;
      }
      // Read the body under the SAME timeout: a provider that sends headers fast
      // then stalls the stream is aborted too, not just the headers wait.
      body = await res.text();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        if (isLast) throw new ProviderTimeoutError(provider, cfg.timeoutMs);
        await deps.sleep(nextWaitMs(undefined, attempt, cfg, deps));
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (RETRYABLE_STATUSES.has(res.status)) {
      if (isLast) throw new ProviderHttpError(res.status, body, provider);
      const retryAfter = parseRetryAfterMs(
        res.headers.get("Retry-After"),
        Date.now(),
      );
      await deps.sleep(nextWaitMs(retryAfter, attempt, cfg, deps));
      continue;
    }
    throw new ProviderHttpError(res.status, body, provider);
  }
}

/**
 * Run async tasks with bounded concurrency, preserving input order. Mirrors
 * songtrivia's album-fetch semaphore (default fan-out 5) so a large traversal
 * never opens unbounded provider connections.
 *
 * @param items - inputs to map.
 * @param limit - max in-flight tasks (must be > 0).
 * @param task - async mapper.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (limit <= 0) throw new Error(`Concurrency limit must be > 0, got ${limit}`);
  const results = new Array<R>(items.length);
  const shared = items.entries();
  async function worker(): Promise<void> {
    for (const [index, item] of shared) {
      results[index] = await task(item, index);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}
