import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    exclude: ["**/node_modules/**", "dist/**"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    coverage: {
      provider: "v8",
      // List every source file that must be covered. Adding a source file here
      // without a matching test fails CI — that is the 100% E2E coverage gate.
      include: [
        "src/shared.ts",
        "src/client/index.ts",
        "src/component/mutations.ts",
        "src/component/queries.ts",
        "src/component/validators.ts",
        "src/component/schema.ts",
        "src/component/providers/fetch.ts",
        "src/component/providers/apple/jwt.ts",
        "src/component/providers/spotify/mappers.ts",
        "src/component/providers/spotify/client.ts",
        "src/component/providers/spotify/impl.ts",
        "src/component/providers/apple/mappers.ts",
        "src/component/providers/apple/impl.ts",
        "src/component/providers/registry.ts",
        "src/component/catalog/browse_order.ts",
        "src/component/catalog/merge.ts",
        "src/component/catalog/mutations.ts",
        "src/component/catalog/queries.ts",
        "src/component/providers/actions.ts",
        "src/component/actions.ts",
        "src/component/config/mutations.ts",
        "src/component/config/queries.ts",
        "src/component/imports/state.ts",
        "src/component/imports/dedupe.ts",
        "src/component/imports/mutations.ts",
        "src/component/imports/queries.ts",
        "src/component/imports/actions.ts",
        "src/component/crons.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
