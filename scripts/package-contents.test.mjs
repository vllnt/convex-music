// @vitest-environment node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { expect, test } from "vitest";

/** Files a consumer (or a coding agent) reads from `node_modules/@vllnt/convex-music/`. */
const REQUIRED = [
  "package.json",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "llms.txt",
  "docs/API.md",
];

/** Contributor-only paths, tests and internal docs that must never ship. */
const FORBIDDEN = [
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^ROADMAP\.md$/,
  /^CONTRIBUTING\.md$/,
  /^(example|scripts|\.github)\//,
  /(^|\/)__tests__\//,
  /\.(test|spec)\.[cm]?[jt]sx?$/,
];

/** Markdown files whose relative links must resolve inside the tarball. */
const LINKED = ["llms.txt", "docs/API.md"];

const REPO_BLOB = "https://github.com/vllnt/convex-music/blob/";

/** @returns {Set<string>} the paths `npm pack` would publish (dist only when built). */
function packedFiles() {
  const output = execFileSync(
    "npm",
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  );
  const [report] = JSON.parse(output);
  return new Set(report.files.map((file) => file.path));
}

/** @param {string} file @returns {string[]} the link targets of a Markdown file. */
function linkTargets(file) {
  const text = readFileSync(file, "utf8");
  return [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]);
}

const packed = packedFiles();

test("the tarball ships the docs agents read", () => {
  expect(REQUIRED.filter((file) => !packed.has(file))).toEqual([]);
});

test("the tarball ships no contributor files, tests or internal docs", () => {
  expect(
    [...packed].filter((file) => FORBIDDEN.some((re) => re.test(file))),
  ).toEqual([]);
});

test.each(LINKED)("relative links in %s resolve inside the tarball", (file) => {
  const unresolved = linkTargets(file)
    .filter((target) => !/^[a-z]+:/i.test(target) && !target.startsWith("#"))
    .map((target) =>
      posix.normalize(posix.join(posix.dirname(file), target.split("#")[0])),
    )
    .filter((target) => !packed.has(target));
  expect(unresolved).toEqual([]);
});

test.each(LINKED)("%s links shipped files relatively, not on GitHub", (file) => {
  const remote = linkTargets(file)
    .filter((target) => target.startsWith(REPO_BLOB))
    .map((target) => target.slice(REPO_BLOB.length).replace(/^[^/]+\//, ""))
    .filter((target) => packed.has(target.split("#")[0]));
  expect(remote).toEqual([]);
});
