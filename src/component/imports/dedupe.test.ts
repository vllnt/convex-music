import { describe, expect, it } from "vitest";
import { buildDedupeKey } from "./dedupe.js";

describe("buildDedupeKey", () => {
  it("joins all fields, normalizing name/isrc/url", () => {
    expect(
      buildDedupeKey({
        entityType: "track",
        requestType: "import",
        targetMode: "isrc",
        providerScope: "any",
        provider: "spotify",
        providerId: "t1",
        entityId: "e1",
        name: "  Daft Punk  ",
        isrc: " gbduw0000059 ",
        url: " https://x ",
        withTracks: true,
      }),
    ).toBe(
      "track|import|isrc|any|spotify|t1|e1|daft punk|GBDUW0000059|https://x|with_tracks",
    );
  });

  it("fills absent fields with the null sentinel + no_tracks", () => {
    expect(
      buildDedupeKey({
        entityType: "artist",
        requestType: "refresh",
        targetMode: "name",
        providerScope: "spotify",
      }),
    ).toBe("artist|refresh|name|spotify|_|_|_|_|_|_|no_tracks");
  });

  it("differs by withTracks so a deep import never collapses into a shallow one", () => {
    const base = {
      entityType: "artist" as const,
      requestType: "import",
      targetMode: "name",
      providerScope: "any",
      name: "X",
    };
    expect(buildDedupeKey({ ...base, withTracks: true })).not.toBe(
      buildDedupeKey({ ...base, withTracks: false }),
    );
  });
});
