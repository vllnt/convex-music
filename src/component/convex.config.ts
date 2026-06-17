import { defineComponent } from "convex/server";
import actionCache from "@convex-dev/action-cache/convex.config";

const component = defineComponent("music");

/**
 * Official child components. `action-cache` caches provider auth tokens (the
 * Spotify client-credentials token and the signed Apple developer JWT) so each
 * read-through action reuses a token rather than re-fetching/re-signing. Further
 * children (`workflow`/`workpool` for import orchestration, `rate-limiter` for
 * the two rate budgets) are added as those layers land.
 */
component.use(actionCache);

export default component;
