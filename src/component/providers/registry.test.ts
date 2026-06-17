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

  it("throws for an unregistered provider", () => {
    expect(() => createProvider("deezer", getToken)).toThrow(
      'No adapter registered for provider "deezer"',
    );
  });

  it("reports registration status", () => {
    expect(isProviderRegistered("spotify")).toBe(true);
    expect(isProviderRegistered("musicbrainz")).toBe(false);
  });

  it("lists registered providers in declaration order", () => {
    expect(listRegisteredProviders()).toEqual(["spotify", "apple"]);
  });
});
