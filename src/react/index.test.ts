// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { makeFunctionReference } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import {
  type ArtistRef,
  type ProjectionRef,
  type SearchRef,
  type TrackRef,
  useArtist,
  useArtistImage,
  useSearchArtists,
  useSearchTracks,
  useTrack,
  useTrackPreview,
} from "./index.js";
import type { CatalogArtist, CatalogTrack } from "../client/types.js";

const { useQuerySpy } = vi.hoisted(() => ({ useQuerySpy: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: useQuerySpy }));

const artistRef: ArtistRef = makeFunctionReference<"query">("music:getArtist");
const trackRef: TrackRef = makeFunctionReference<"query">("music:getTrack");
const imageRef: ProjectionRef = makeFunctionReference<"query">("music:getArtistImage");
const previewRef: ProjectionRef = makeFunctionReference<"query">("music:getTrackPreview");
const searchArtistsRef: SearchRef<CatalogArtist> =
  makeFunctionReference<"query">("music:searchArtists");
const searchTracksRef: SearchRef<CatalogTrack> =
  makeFunctionReference<"query">("music:searchTracks");

beforeEach(() => useQuerySpy.mockReset());

test("useArtist / useTrack forward the id and return the row", () => {
  useQuerySpy.mockReturnValue({ name: "Daft Punk" });
  const { result } = renderHook(() => useArtist(artistRef, "a1"));
  expect(useQuerySpy).toHaveBeenCalledWith(artistRef, { id: "a1" });
  expect(result.current).toEqual({ name: "Daft Punk" });

  useQuerySpy.mockReturnValue({ title: "One More Time" });
  renderHook(() => useTrack(trackRef, "t1"));
  expect(useQuerySpy).toHaveBeenCalledWith(trackRef, { id: "t1" });
});

test("useArtistImage / useTrackPreview forward provider + policy", () => {
  useQuerySpy.mockReturnValue("https://img");
  const { result } = renderHook(() =>
    useArtistImage(imageRef, "spotify", "a1", { from: "apple" }),
  );
  expect(useQuerySpy).toHaveBeenCalledWith(imageRef, {
    provider: "spotify",
    providerId: "a1",
    policy: { from: "apple" },
  });
  expect(result.current).toBe("https://img");

  renderHook(() => useTrackPreview(previewRef, "deezer", "t1"));
  expect(useQuerySpy).toHaveBeenCalledWith(previewRef, {
    provider: "deezer",
    providerId: "t1",
    policy: undefined,
  });
});

test("useSearchArtists / useSearchTracks forward the query + limit", () => {
  useQuerySpy.mockReturnValue([{ name: "X" }]);
  const { result } = renderHook(() => useSearchArtists(searchArtistsRef, "daft", 5));
  expect(useQuerySpy).toHaveBeenCalledWith(searchArtistsRef, {
    query: "daft",
    limit: 5,
  });
  expect(result.current).toEqual([{ name: "X" }]);

  renderHook(() => useSearchTracks(searchTracksRef, "lucky"));
  expect(useQuerySpy).toHaveBeenCalledWith(searchTracksRef, {
    query: "lucky",
    limit: undefined,
  });
});
