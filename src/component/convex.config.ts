import { defineComponent } from "convex/server";
import actionCache from "@convex-dev/action-cache/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

/** Component definition. Mount it with `app.use(music)` in `convex/convex.config.ts`. */
const component = defineComponent("music");

/**
 * Official child components, composed (never re-implemented):
 * - `action-cache` — provider token cache (Spotify token + signed Apple JWT).
 * - `rate-limiter` — auto-import throughput budgets (token buckets, separate for
 *   new-source import vs stale-row refresh), decoupled from cron frequency.
 *
 * The import traversal is a bounded fetch→upsert fan-out run inline in one action,
 * with the request lifecycle tracked in the component's own `importRequests` table
 * (a control-plane status machine, enforced by `imports/state.ts`). It is not
 * durable, resumable, multi-step orchestration, so it does NOT compose
 * `@convex-dev/workflow`/`workpool`; in-action batch concurrency is bounded with
 * `mapWithConcurrency`. A workflow-backed durable traversal is a future option if
 * catalogs grow large enough to need resumable, cross-failure imports.
 *
 * Deferred: `@vllnt/convex-idempotency` — import-request dedup is the
 * component-owned active-request control-plane check (serializable under Convex
 * OCC; see `imports/mutations.ts`).
 *
 * On `convex@^1.41`, `action-cache` 0.3.0's `fetch` ctx type lags the widened
 * query-context `runQuery` (a cosmetic seam); bridged at the call site — see
 * `providers/actions.ts`.
 */
component.use(actionCache);
component.use(rateLimiter);

export default component;
