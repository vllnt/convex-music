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
 * Deferred (version/compat): a directly-mounted `@convex-dev/workpool` for the
 * auto-import batch sweep (0.4.7's `ComponentDefinition` skews against convex
 * 1.36.1) and `@convex-dev/rate-limiter` land with `auto-import`.
 * `@vllnt/convex-idempotency` (import-request dedup) is deferred too: its canary
 * peers `convex@^1.41`, conflicting with `action-cache`'s 1.36.1 ctx — dedup is
 * the component-owned active-request control-plane check until that aligns.
 */
component.use(actionCache);
component.use(workflow);

export default component;
