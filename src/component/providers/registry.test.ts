import { describe, expect, it } from "vitest";
import {
  createProvider,
  isProviderRegistered,
  listRegisteredProviders,
} from "./registry.js";

const getToken = () => Promise.resolve("tok");

describe("provider registry", () => {
  it("builds the Spotify adapter", () => {
    expect(createProvider("spotify", getToken).id).toBe("spotify");
  });

  it("builds the Apple adapter", () => {
    expect(createProvider("apple", getToken).id).toBe("apple");
  });

  it("builds the MusicBrainz adapter (no-auth)", () => {
    expect(createProvider("musicbrainz", getToken).id).toBe("musicbrainz");
  });

  it("builds the Deezer adapter (no-auth)", () => {
    expect(createProvider("deezer", getToken).id).toBe("deezer");
  });

  it("throws for an unregistered provider", () => {
    expect(() => createProvider("wikidata", getToken)).toThrow(
      'No adapter registered for provider "wikidata"',
    );
  });

  it("reports registration status", () => {
    expect(isProviderRegistered("spotify")).toBe(true);
    expect(isProviderRegistered("wikidata")).toBe(false);
  });

  it("lists registered providers in declaration order", () => {
    expect(listRegisteredProviders()).toEqual([
      "spotify",
      "apple",
      "musicbrainz",
      "deezer",
    ]);
  });
});
