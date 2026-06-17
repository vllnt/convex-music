import { describe, expect, it } from "vitest";
import { createProvider } from "./registry.js";
import type { Provider } from "../../shared.js";

const getToken = () => Promise.resolve("tok");

describe("provider registry", () => {
  it.each(["spotify", "apple", "musicbrainz", "deezer", "wikidata"] as const)(
    "builds the %s adapter",
    (id: Provider) => {
      expect(createProvider(id, getToken).id).toBe(id);
    },
  );
});
