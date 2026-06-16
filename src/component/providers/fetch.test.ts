import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RETRY_CONFIG,
  type FetchDeps,
  type RetryConfig,
  ProviderHttpError,
  ProviderTimeoutError,
  defaultFetchDeps,
  fetchJson,
  mapWithConcurrency,
} from "./fetch.js";

type Step = () => Promise<Response>;

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function abortError(): Error {
  const err = new Error("aborted");
  err.name = "AbortError";
  return err;
}

/** A fake `fetch` that plays a queue of steps (each returns or throws). */
function fakeFetch(steps: Step[]): {
  fetch: FetchDeps["fetch"];
  calls: () => number;
} {
  let i = 0;
  return {
    fetch: () => {
      const step = steps[i];
      i += 1;
      if (step === undefined) throw new Error("fakeFetch: out of steps");
      return step();
    },
    calls: () => i,
  };
}

/** Deps with a recorded no-op sleep and a fixed RNG. */
function testDeps(steps: Step[], random = 0): {
  deps: FetchDeps;
  sleeps: number[];
  calls: () => number;
} {
  const sleeps: number[] = [];
  const ff = fakeFetch(steps);
  return {
    deps: {
      fetch: ff.fetch,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      random: () => random,
    },
    sleeps,
    calls: ff.calls,
  };
}

const FAST: RetryConfig = { ...DEFAULT_RETRY_CONFIG, maxAttempts: 4 };

describe("fetchJson", () => {
  it("returns parsed JSON on a 2xx", async () => {
    const { deps } = testDeps([() => Promise.resolve(jsonResponse({ ok: 1 }))]);
    expect(await fetchJson("spotify", "https://x", {}, FAST, deps)).toEqual({
      ok: 1,
    });
  });

  it("retries an overload 5xx then succeeds (backoff, no Retry-After)", async () => {
    const { deps, sleeps, calls } = testDeps([
      () => Promise.resolve(new Response("busy", { status: 503 })),
      () => Promise.resolve(jsonResponse({ ok: 2 })),
    ]);
    expect(await fetchJson("apple", "https://x", {}, FAST, deps)).toEqual({
      ok: 2,
    });
    expect(calls()).toBe(2);
    expect(sleeps).toEqual([1000]); // 2^0 * 1000 + 0 jitter
  });

  it("retries 529 and 500 across multiple attempts", async () => {
    const { deps, sleeps } = testDeps([
      () => Promise.resolve(new Response("overloaded", { status: 529 })),
      () => Promise.resolve(new Response("err", { status: 500 })),
      () => Promise.resolve(jsonResponse({ ok: 3 })),
    ]);
    expect(await fetchJson("apple", "https://x", {}, FAST, deps)).toEqual({
      ok: 3,
    });
    expect(sleeps).toEqual([1000, 2000]); // exp backoff: 2^0, 2^1
  });

  it("honors a numeric Retry-After header", async () => {
    const { deps, sleeps } = testDeps([
      () =>
        Promise.resolve(
          new Response("slow", {
            status: 429,
            headers: { "Retry-After": "2" },
          }),
        ),
      () => Promise.resolve(jsonResponse({ ok: 4 })),
    ]);
    await fetchJson("spotify", "https://x", {}, FAST, deps);
    expect(sleeps).toEqual([2000]);
  });

  it("clamps a past HTTP-date Retry-After to zero", async () => {
    const { deps, sleeps } = testDeps([
      () =>
        Promise.resolve(
          new Response("slow", {
            status: 429,
            headers: { "Retry-After": "Thu, 01 Jan 1970 00:00:00 GMT" },
          }),
        ),
      () => Promise.resolve(jsonResponse({ ok: 5 })),
    ]);
    await fetchJson("spotify", "https://x", {}, FAST, deps);
    expect(sleeps).toEqual([0]);
  });

  it("falls back to backoff when Retry-After is unparseable", async () => {
    const { deps, sleeps } = testDeps([
      () =>
        Promise.resolve(
          new Response("slow", {
            status: 429,
            headers: { "Retry-After": "banana" },
          }),
        ),
      () => Promise.resolve(jsonResponse({ ok: 6 })),
    ]);
    await fetchJson("spotify", "https://x", {}, FAST, deps);
    expect(sleeps).toEqual([1000]);
  });

  it("caps backoff + jitter at maxWaitMs", async () => {
    const capped: RetryConfig = {
      maxAttempts: 4,
      maxWaitMs: 500,
      jitterMs: 250,
      timeoutMs: 15_000,
    };
    const { deps, sleeps } = testDeps(
      [
        () =>
          Promise.resolve(
            new Response("slow", {
              status: 429,
              headers: { "Retry-After": "9999" },
            }),
          ),
        () => Promise.resolve(jsonResponse({ ok: 7 })),
      ],
      0.9, // jitter 0.9*250 = 225
    );
    await fetchJson("spotify", "https://x", {}, capped, deps);
    expect(sleeps).toEqual([500]); // min(500, 9_999_000 + 225)
  });

  it("throws ProviderHttpError after retryable attempts are exhausted", async () => {
    const tiny: RetryConfig = { ...FAST, maxAttempts: 2 };
    const { deps, calls } = testDeps([
      () => Promise.resolve(new Response("busy", { status: 503 })),
      () => Promise.resolve(new Response("still busy", { status: 503 })),
    ]);
    await expect(fetchJson("apple", "https://x", {}, tiny, deps)).rejects.toThrow(
      ProviderHttpError,
    );
    expect(calls()).toBe(2);
  });

  it("throws immediately on a non-retryable status (404)", async () => {
    const { deps, calls } = testDeps([
      () => Promise.resolve(new Response("nope", { status: 404 })),
    ]);
    await expect(
      fetchJson("spotify", "https://x", {}, FAST, deps),
    ).rejects.toThrow(ProviderHttpError);
    expect(calls()).toBe(1);
  });

  it("retries a timeout then succeeds", async () => {
    const { deps, sleeps } = testDeps([
      () => Promise.reject(abortError()),
      () => Promise.resolve(jsonResponse({ ok: 8 })),
    ]);
    expect(await fetchJson("apple", "https://x", {}, FAST, deps)).toEqual({
      ok: 8,
    });
    expect(sleeps).toEqual([1000]);
  });

  it("throws ProviderTimeoutError when every attempt times out", async () => {
    const tiny: RetryConfig = { ...FAST, maxAttempts: 2 };
    const { deps } = testDeps([
      () => Promise.reject(abortError()),
      () => Promise.reject(abortError()),
    ]);
    await expect(fetchJson("apple", "https://x", {}, tiny, deps)).rejects.toThrow(
      ProviderTimeoutError,
    );
  });

  it("rethrows a non-abort network error without retry", async () => {
    const { deps, calls } = testDeps([
      () => Promise.reject(new Error("ECONNRESET")),
    ]);
    await expect(
      fetchJson("spotify", "https://x", {}, FAST, deps),
    ).rejects.toThrow("ECONNRESET");
    expect(calls()).toBe(1);
  });

  it("uses default config + deps against a stubbed global fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse({ ok: "default" }))),
    );
    try {
      expect(await fetchJson("spotify", "https://x")).toEqual({ ok: "default" });
      // exercise the default dep closures directly
      await defaultFetchDeps.fetch("https://x", {});
      await defaultFetchDeps.sleep(0);
      expect(typeof defaultFetchDeps.random()).toBe("number");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("mapWithConcurrency", () => {
  it("maps preserving input order", async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, (n) =>
      Promise.resolve(n * 10),
    );
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it("bounds in-flight tasks to the limit", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return n;
    });
    expect(out).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("clamps worker count when limit exceeds item count", async () => {
    const out = await mapWithConcurrency([1, 2], 10, (n) =>
      Promise.resolve(n + 1),
    );
    expect(out).toEqual([2, 3]);
  });

  it("returns empty for empty input", async () => {
    expect(await mapWithConcurrency([], 4, () => Promise.resolve(1))).toEqual(
      [],
    );
  });

  it("throws on a non-positive limit", async () => {
    await expect(
      mapWithConcurrency([1], 0, (n) => Promise.resolve(n)),
    ).rejects.toThrow("Concurrency limit must be > 0");
  });
});
