import type { FunctionArgs } from "convex/server";
import { expectTypeOf, test } from "vitest";
import type { ComponentApi } from "../component/_generated/component.js";
import type {
  ImportAlbumInput,
  ImportPlaylistInput,
  ImportTrackInput,
} from "./index.js";

// Compile-time checks, run by `pnpm typecheck:ci`: each client input type must
// accept exactly the keys the component's argument validator accepts, or Convex
// rejects the call at runtime with an "extra field" error.
type ServerArgs = ComponentApi["imports"]["actions"];

test("importPlaylist input has the server validator's keys, without withAlbum", () => {
  expectTypeOf<Extract<keyof ImportPlaylistInput, "withAlbum">>().toBeNever();
  expectTypeOf<keyof ImportPlaylistInput>().toEqualTypeOf<
    keyof FunctionArgs<ServerArgs["importPlaylist"]>
  >();
});

test("importAlbum input has the server validator's keys, without withAlbum", () => {
  expectTypeOf<Extract<keyof ImportAlbumInput, "withAlbum">>().toBeNever();
  expectTypeOf<keyof ImportAlbumInput>().toEqualTypeOf<
    keyof FunctionArgs<ServerArgs["importAlbum"]>
  >();
});

test("importTrack input keeps withAlbum, which its server validator accepts", () => {
  expectTypeOf<keyof ImportTrackInput>().toEqualTypeOf<
    keyof FunctionArgs<ServerArgs["importTrack"]>
  >();
});
