import { defineComponent } from "convex/server";
import actionCache from "@convex-dev/action-cache/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

const component = defineComponent("music");

/**
 * Official child components, composed (never re-implemented):
 * - `action-cache` — provider token cache (Spotify token + signed Apple JWT).
 * - `workflow` — durable multi-step import traversal (playlist → tracks →
 *   artists) with step retries; the import control-plane state machine is layered
 *   over it in the component's own tables. Workflow bundles its own `workpool`
 *   for step execution, so no separate workpool mount is needed for import.
 *
 * Deferred: a directly-mounted `@convex-dev/workpool` + `@convex-dev/rate-limiter`
 * for the auto-import sweep — the per-run count limit suffices today; the
 * rate-limiter throughput budget is a later refinement. `@vllnt/convex-idempotency`
 * (import-request dedup) is also deferred — dedup is the component-owned
 * active-request control-plane check.
 *
 * On `convex@^1.41`, `action-cache` 0.3.0's `fetch` ctx type lags the widened
 * query-context `runQuery` (a cosmetic seam); bridged at the call site — see
 * `providers/actions.ts`.
 */
component.use(actionCache);
component.use(workflow);

export default component;
