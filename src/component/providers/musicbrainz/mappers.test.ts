import { describe, expect, it } from "vitest";
import { mapMusicBrainzArtist } from "./mappers.js";
import type { MusicBrainzArtist } from "./types.js";

describe("mapMusicBrainzArtist", () => {
  it("maps full facts (group, country, gender, debut, tags)", () => {
    const raw: MusicBrainzArtist = {
      id: "mb1",
      name: "Daft Punk",
      country: "FR",
      gender: null,
      type: "Group",
      "life-span": { begin: "1993-05-01" },
      tags: [{ name: "french house", count: 5 }, { name: "electronic" }],
    };
    expect(mapMusicBrainzArtist(raw)).toEqual({
      name: "Daft Punk",
      genres: ["french house", "electronic"],
      country: "FR",
      gender: undefined,
      members: "group",
      debutYear: 1993,
    });
  });

  it("maps a solo person with gender + year-only debut", () => {
    expect(
      mapMusicBrainzArtist({
        id: "mb2",
        name: "Beyoncé",
        country: "US",
        gender: "Female",
        type: "Person",
        "life-span": { begin: "1981" },
      }),
    ).toEqual({
      name: "Beyoncé",
      genres: [],
      country: "US",
      gender: "Female",
      members: "solo",
      debutYear: 1981,
    });
  });

  it("omits unknown facts (no type, no country, no begin)", () => {
    expect(
      mapMusicBrainzArtist({ id: "mb3", name: "Mystery", type: "Orchestra" }),
    ).toEqual({
      name: "Mystery",
      genres: [],
      country: undefined,
      gender: undefined,
      members: undefined,
      debutYear: undefined,
    });
  });

  it("treats a null/blank begin as no debut year", () => {
    expect(
      mapMusicBrainzArtist({
        id: "mb4",
        name: "X",
        "life-span": { begin: null },
      }).debutYear,
    ).toBeUndefined();
    expect(
      mapMusicBrainzArtist({
        id: "mb5",
        name: "Y",
        "life-span": { begin: "unknown" },
      }).debutYear,
    ).toBeUndefined();
  });
});
