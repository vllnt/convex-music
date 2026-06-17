/// <reference types="vite/client" />
import { register as registerActionCache } from "@convex-dev/action-cache/test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import type { TestConvex } from "convex-test";
import type { GenericSchema, SchemaDefinition } from "convex/server";
import schema from "./component/schema.js";

const modules = import.meta.glob("./component/**/*.ts");

/**
 * Register this component (and its child `action-cache` + `rate-limiter`
 * components) with a `convex-test` instance so consuming apps can test
 * integration: `import { register } from "@vllnt/convex-music/test"`.
 */
export function register(
  t: TestConvex<SchemaDefinition<GenericSchema, boolean>>,
  name: string = "music",
): void {
  t.registerComponent(name, schema, modules);
  registerActionCache(t, `${name}/actionCache`);
  registerRateLimiter(t, `${name}/rateLimiter`);
}
