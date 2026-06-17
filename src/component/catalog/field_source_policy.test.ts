import { describe, expect, it } from "vitest";
import { projectField } from "./field_source_policy.js";

interface Entry {
  provider: "spotify" | "apple" | "wikidata";
  imageUrl?: string;
}

const entries: Entry[] = [
  { provider: "spotify", imageUrl: "https://sp/img" },
  { provider: "apple", imageUrl: "https://ap/img" },
  { provider: "wikidata" }, // no image
];

const image = (e: Entry) => e.imageUrl;

describe("projectField", () => {
  it("returns the fallback when no spec is given", () => {
    expect(projectField(entries, undefined, image, "fb")).toBe("fb");
  });

  it("{from}: uses the named provider's value", () => {
    expect(projectField(entries, { from: "apple" }, image, "fb")).toBe(
      "https://ap/img",
    );
  });

  it("{from}: falls back when the named provider has no value", () => {
    expect(projectField(entries, { from: "wikidata" }, image, "fb")).toBe("fb");
  });

  it("{from}: falls back when the named provider is absent", () => {
    expect(projectField(entries, { from: "deezer" }, image, "fb")).toBe("fb");
  });

  it("{prefer}: takes the first available, skipping providers without a value", () => {
    expect(
      projectField(entries, { prefer: ["wikidata", "spotify"] }, image, "fb"),
    ).toBe("https://sp/img");
  });

  it("{prefer}: falls back when none have a value", () => {
    expect(
      projectField(entries, { prefer: ["wikidata", "deezer"] }, image, "fb"),
    ).toBe("fb");
  });
});
