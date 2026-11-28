// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * The release workflow (`publish.yml` › Verify release tag) publishes the
 * `## [<package.json version>]` section of CHANGELOG.md as the GitHub release
 * notes, so the next version's entries must all live in that one section.
 */
const version = JSON.parse(readFileSync("package.json", "utf8")).version;
const headings = readFileSync("CHANGELOG.md", "utf8")
  .split("\n")
  .filter((line) => line.startsWith("## ["))
  .map((line) => /^## \[([^\]]+)\]/.exec(line)?.[1]);

test("CHANGELOG.md has exactly one section for the package.json version", () => {
  expect(headings.filter((heading) => heading === version)).toHaveLength(1);
});

test("CHANGELOG.md has no [Unreleased] section beside the package.json version", () => {
  expect(headings).not.toContain("Unreleased");
});

test("the package.json version section is the newest one", () => {
  expect(headings[0]).toBe(version);
});
