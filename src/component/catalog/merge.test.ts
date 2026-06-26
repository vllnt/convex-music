import { describe, expect, it } from "vitest";
import type {
  NormalizedArtist,
  NormalizedTrack,
} from "../../client/types.js";
import {
  type ArtistMergeState,
  type TrackMergeState,
  mergeArtist,
  mergeTrack,
} from "./merge.js";

const artist = (over: Partial<NormalizedArtist> = {}): NormalizedArtist => ({
  name: "Daft Punk",
  genres: [],
  ...over,
});

const track = (over: Partial<NormalizedTrack> = {}): NormalizedTrack => ({
  title: "One More Time",
  artists: [],
  genres: [],
  ...over,
});

describe("mergeArtist", () => {
  it("creates fresh state from one provider", () => {
    const merged = mergeArtist(null, "spotify", "a1", {
      name: "Daft Punk",
      genres: ["house"],
      popularity: 80,
      imageUrl: "https://img",
      url: "https://sp",
      country: "FR",
      gender: "male",
      debutYear: 1993,
      members: "group",
    });
    expect(merged).toEqual<ArtistMergeState>({
      genres: ["house"],
      popularity: 80,
      imageUrl: "https://img",
      country: "FR",
      gender: "male",
      debutYear: 1993,
      members: "group",
      providers: [
        {
          provider: "spotify",
          providerId: "a1",
          imageUrl: "https://img",
          url: "https://sp",
          popularity: 80,
          genres: ["house"],
        },
      ],
    });
  });

  it("unions genres, takes max popularity, appends a new provider", () => {
    const existing: ArtistMergeState = {
      genres: ["house"],
      popularity: 70,
      imageUrl: "https://sp-img",
      country: "FR",
      providers: [{ provider: "spotify", providerId: "a1", popularity: 70 }],
    };
    const merged = mergeArtist(
      existing,
      "apple",
      "a9",
      artist({ genres: ["electronic"], popularity: 90, imageUrl: "https://ap-img" }),
    );
    expect(merged.genres).toEqual(["house", "electronic"]);
    expect(merged.popularity).toBe(90);
    expect(merged.imageUrl).toBe("https://ap-img");
    expect(merged.country).toBe("FR"); // preserved from base
    expect(merged.providers).toHaveLength(2);
  });

  it("replaces the same provider's entry rather than duplicating", () => {
    const existing: ArtistMergeState = {
      genres: [],
      providers: [{ provider: "spotify", providerId: "old", popularity: 50 }],
    };
    const merged = mergeArtist(existing, "spotify", "new", artist({ popularity: 60 }));
    expect(merged.providers).toEqual([
      {
        provider: "spotify",
        providerId: "new",
        imageUrl: undefined,
        url: undefined,
        popularity: 60,
        genres: [],
      },
    ]);
  });

  it("keeps existing facts when the incoming provider omits them", () => {
    const existing: ArtistMergeState = {
      genres: [],
      popularity: 65,
      imageUrl: "https://keep",
      country: "FR",
      gender: "male",
      debutYear: 1993,
      members: "group",
      providers: [{ provider: "spotify", providerId: "a1" }],
    };
    const merged = mergeArtist(existing, "apple", "a2", artist());
    expect(merged.popularity).toBe(65); // incoming undefined -> base
    expect(merged.imageUrl).toBe("https://keep");
    expect(merged.country).toBe("FR");
    expect(merged.gender).toBe("male");
    expect(merged.debutYear).toBe(1993);
    expect(merged.members).toBe("group");
  });
});

describe("mergeTrack", () => {
  it("creates fresh state from one provider", () => {
    const merged = mergeTrack(null, "spotify", "t1", {
      title: "One More Time",
      artists: [],
      genres: ["house"],
      popularity: 85,
      previewUrl: "https://prev",
      coverUrl: "https://cov",
      url: "https://sp",
      durationMs: 320_000,
    });
    expect(merged).toEqual<TrackMergeState>({
      genres: ["house"],
      popularity: 85,
      durationMs: 320_000,
      providers: [
        {
          provider: "spotify",
          providerId: "t1",
          previewUrl: "https://prev",
          coverUrl: "https://cov",
          url: "https://sp",
        },
      ],
    });
  });

  it("appends a second provider + keeps the longer duration", () => {
    const existing: TrackMergeState = {
      genres: ["house"],
      popularity: 80,
      durationMs: 320_000,
      providers: [{ provider: "spotify", providerId: "t1" }],
    };
    const merged = mergeTrack(existing, "apple", "t9", track({ durationMs: 100 }));
    expect(merged.durationMs).toBe(320_000); // max(320000, 100)
    expect(merged.genres).toEqual(["house"]);
    expect(merged.popularity).toBe(80);
    expect(merged.providers).toHaveLength(2);
  });

  it("adopts the incoming duration when base has none", () => {
    const existing: TrackMergeState = {
      genres: [],
      providers: [{ provider: "spotify", providerId: "t1" }],
    };
    const merged = mergeTrack(existing, "apple", "t2", track({ durationMs: 200 }));
    expect(merged.durationMs).toBe(200);
  });

  it("unions genres + takes max popularity across providers", () => {
    const existing: TrackMergeState = {
      genres: ["house"],
      popularity: 70,
      durationMs: 320_000,
      providers: [{ provider: "spotify", providerId: "t1" }],
    };
    const merged = mergeTrack(
      existing,
      "apple",
      "t9",
      track({ genres: ["electronic"], popularity: 90 }),
    );
    expect(merged.genres).toEqual(["house", "electronic"]);
    expect(merged.popularity).toBe(90);
  });
});
