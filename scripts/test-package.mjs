import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

import {
  checkDocumentation,
  convexHost,
  writeHost,
} from "./check-documentation.mjs";

const root = process.cwd();
/** @type {unknown} */
const metadata = JSON.parse(readFileSync("package.json", "utf8"));
if (
  typeof metadata !== "object" ||
  metadata === null ||
  !("name" in metadata) ||
  !("version" in metadata) ||
  typeof metadata.name !== "string" ||
  typeof metadata.version !== "string"
)
  throw new Error("invalid package metadata");
const tarball = `${metadata.name.replace("@", "").replace("/", "-")}-${metadata.version}.tgz`;
const temporary = mkdtempSync(join(tmpdir(), "music-consumer-"));
/** @param {string} command @param {string[]} arguments_ @param {string} [cwd] */
const run = (command, arguments_, cwd = temporary) =>
  execFileSync(command, arguments_, { cwd, stdio: "inherit" });
/** Strict type-check of consumer files. @param {string} resolution @param {string[]} files */
const typecheck = (resolution, files) =>
  run("pnpm", [
    "exec",
    "tsc",
    "--noEmit",
    "--strict",
    "--module",
    resolution === "Bundler" ? "ESNext" : "NodeNext",
    "--moduleResolution",
    resolution,
    "--target",
    "ES2022",
    "--types",
    resolution === "Bundler" ? "vite/client,node" : "node",
    ...files,
  ]);
try {
  run("pnpm", ["pack", "--pack-destination", temporary], root);
  writeFileSync(
    join(temporary, "package.json"),
    JSON.stringify({
      pnpm: { ignoredBuiltDependencies: ["esbuild"] },
      private: true,
      type: "module",
    }),
  );
  // The root workspace file carries the release-age gate, so the consumer install keeps it.
  // pnpm 11 reads the build-script policy from the workspace file, pnpm 10 from package.json.
  writeFileSync(
    join(temporary, "pnpm-workspace.yaml"),
    `${readFileSync(join(root, "pnpm-workspace.yaml"), "utf8")}allowBuilds:\n  esbuild: false\n`,
  );
  // The lowest supported convex peer; react for the ./react entry.
  run("pnpm", [
    "add",
    join(temporary, tarball),
    "convex@1.45.0",
    "typescript@5.9.3",
    "convex-test@0.0.56",
    "vite@8.2.2",
    "@types/node@22.20.2",
    "vitest@5.1.1",
    "@edge-runtime/vm@5.0.0",
    "react@19.3.1",
    "@types/react@19.3.0",
  ]);
  // Agents read the bundled docs from node_modules, so they must ship and resolve.
  const installed = join(temporary, "node_modules", metadata.name);
  const missing = [
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "llms.txt",
    ...readdirSync(join(root, "docs")).map((file) => `docs/${file}`),
  ].filter((file) => !existsSync(join(installed, file)));
  if (missing.length > 0)
    throw new Error(`tarball is missing ${missing.join(", ")}`);
  // Docs contract, then README examples run against the built package in a stub host.
  const examples = checkDocumentation(installed, temporary);
  const hostFiles = writeHost(
    temporary,
    convexHost(installed, examples),
    examples,
  );
  typecheck("Bundler", hostFiles);
  // The README's own vitest.config.mts runs its test example.
  run("pnpm", ["exec", "vitest", "run"]);
  writeFileSync(
    join(temporary, "consumer.ts"),
    `
import { Music } from "@vllnt/convex-music";
import type { ComponentApi } from "@vllnt/convex-music/_generated/component.js";
import type { ComponentApi as BareComponentApi } from "@vllnt/convex-music/_generated/component";
import config from "@vllnt/convex-music/convex.config.js";
import bareConfig from "@vllnt/convex-music/convex.config";
import { useArtist } from "@vllnt/convex-music/react";
import { defineApp } from "convex/server";
declare const component: ComponentApi;
declare const bareComponent: BareComponentApi;
const client = new Music(component);
const app = defineApp(); app.use(config); app.use(bareConfig, { name: "music2" });
void client; void new Music(bareComponent); void app; void useArtist;
`,
  );
  typecheck("NodeNext", ["consumer.ts"]);
  writeFileSync(
    join(temporary, "registration.ts"),
    `
import { register } from "@vllnt/convex-music/test";
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
const host = defineSchema({ unrelated: defineTable({ label: v.string() }) });
register(convexTest(host, {}), "custom");
`,
  );
  typecheck("Bundler", ["registration.ts"]);
  // The shipped test helper is TypeScript source: it must also compile for NodeNext consumers.
  typecheck("NodeNext", ["registration.ts"]);
  // convex.config is loaded by the Convex bundler, not plain Node: the
  // rate-limiter's batch-worker child uses extensionless ESM imports.
  run("node", [
    "--input-type=module",
    "-e",
    'import { Music } from "@vllnt/convex-music"; import { useArtist } from "@vllnt/convex-music/react"; if (!Music || !useArtist) throw Error("missing export");',
  ]);
} finally {
  rmSync(temporary, { force: true, recursive: true });
}
