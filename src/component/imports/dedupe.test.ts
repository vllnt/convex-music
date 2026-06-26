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
        withAlbum: true,
      }),
    ).toBe(
      "track|import|isrc|any|spotify|t1|e1|daft punk|GBDUW0000059|https://x|tracks:top|album:1",
    );
  });

  it("fills absent fields with the null sentinel + tracks:none/album:0", () => {
    expect(
      buildDedupeKey({
        entityType: "artist",
        requestType: "refresh",
        targetMode: "name",
        providerScope: "spotify",
      }),
    ).toBe("artist|refresh|name|spotify|_|_|_|_|_|_|tracks:none|album:0");
  });

  it("differs by the effective track depth so a deep import never collapses into a shallow one", () => {
    const base = {
      entityType: "artist" as const,
      requestType: "import",
      targetMode: "name",
      providerScope: "any",
      name: "X",
    };
    // explicit depth, the legacy withTracks alias, and the default must all differ
    const all = buildDedupeKey({ ...base, tracks: "all" });
    const top = buildDedupeKey({ ...base, tracks: "top" });
    const aliasTop = buildDedupeKey({ ...base, withTracks: true });
    const none = buildDedupeKey({ ...base, withTracks: false });
    expect(new Set([all, top, none]).size).toBe(3);
    expect(aliasTop).toBe(top); // withTracks:true is the `top` alias
  });

  it("differs by withAlbum so a track+album import never collapses into a track-only one", () => {
    const base = {
      entityType: "track" as const,
      requestType: "import",
      targetMode: "providerId",
      providerScope: "any",
      providerId: "t1",
    };
    expect(buildDedupeKey({ ...base, withAlbum: true })).not.toBe(
      buildDedupeKey({ ...base, withAlbum: false }),
    );
  });
});
