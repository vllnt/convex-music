import { describe, expect, it } from "vitest";
import { mapWikidataArtist } from "./mappers.js";
import type { WikidataSnakValue } from "./types.js";

const claim = (value: WikidataSnakValue) => [
  { mainsnak: { datavalue: { value } } },
];

describe("mapWikidataArtist", () => {
  it("maps a solo female with debut year", () => {
    expect(
      mapWikidataArtist({
        labels: { en: { value: "Beyoncé" } },
        claims: {
          P21: claim({ id: "Q6581072" }),
          P31: claim({ id: "Q5" }),
          P571: claim({ time: "+1981-09-04T00:00:00Z" }),
        },
      }),
    ).toEqual({
      name: "Beyoncé",
      genres: [],
      gender: "Female",
      members: "solo",
      debutYear: 1981,
    });
  });

  it("maps a group (P31 band) with male unknown-mapped gender omitted", () => {
    expect(
      mapWikidataArtist({
        labels: { en: { value: "Daft Punk" } },
        claims: {
          P31: claim({ id: "Q215380" }),
          P21: claim({ id: "Q999999" }),
        },
      }),
    ).toMatchObject({ name: "Daft Punk", members: "group", gender: undefined });
  });

  it("omits everything when claims/label are absent", () => {
    expect(mapWikidataArtist({})).toEqual({
      name: "",
      genres: [],
      gender: undefined,
      members: undefined,
      debutYear: undefined,
    });
  });

  it("ignores claims with no datavalue + unparsable dates", () => {
    expect(
      mapWikidataArtist({
        labels: { en: { value: "X" } },
        claims: {
          P31: [{ mainsnak: {} }],
          P571: claim({ time: "unknown" }),
        },
      }),
    ).toMatchObject({ members: undefined, debutYear: undefined });
  });
});
