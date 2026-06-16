/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    mutations: {
      invalidate: FunctionReference<
        "mutation",
        "internal",
        {
          externalId: string;
          kind: "track" | "artist" | "album";
          provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        },
        boolean,
        Name
      >;
      pruneExpired: FunctionReference<"mutation", "internal", {}, number, Name>;
      put: FunctionReference<
        "mutation",
        "internal",
        {
          externalId: string;
          isrc?: string;
          kind: "track" | "artist" | "album";
          provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
          ttlMs?: number;
          value:
            | {
                artists: Array<{ externalId?: string; name: string }>;
                coverUrl?: string;
                durationMs?: number;
                isrc?: string;
                previewUrl?: string;
                title: string;
                url?: string;
              }
            | {
                country?: string;
                debutYear?: number;
                gender?: string;
                genres: Array<string>;
                imageUrl?: string;
                members?: "solo" | "group";
                name: string;
                popularity?: number;
                url?: string;
              }
            | {
                artists: Array<{ externalId?: string; name: string }>;
                coverUrl?: string;
                releaseDate?: string;
                title: string;
                trackCount?: number;
                url?: string;
              };
        },
        string,
        Name
      >;
    };
    queries: {
      get: FunctionReference<
        "query",
        "internal",
        {
          externalId: string;
          kind: "track" | "artist" | "album";
          provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        },
        null | {
          _creationTime: number;
          _id: string;
          expiresAt: number;
          externalId: string;
          fetchedAt: number;
          isrc?: string;
          kind: "track" | "artist" | "album";
          provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
          value:
            | {
                artists: Array<{ externalId?: string; name: string }>;
                coverUrl?: string;
                durationMs?: number;
                isrc?: string;
                previewUrl?: string;
                title: string;
                url?: string;
              }
            | {
                country?: string;
                debutYear?: number;
                gender?: string;
                genres: Array<string>;
                imageUrl?: string;
                members?: "solo" | "group";
                name: string;
                popularity?: number;
                url?: string;
              }
            | {
                artists: Array<{ externalId?: string; name: string }>;
                coverUrl?: string;
                releaseDate?: string;
                title: string;
                trackCount?: number;
                url?: string;
              };
        },
        Name
      >;
      getByIsrc: FunctionReference<
        "query",
        "internal",
        { isrc: string },
        Array<{
          _creationTime: number;
          _id: string;
          expiresAt: number;
          externalId: string;
          fetchedAt: number;
          isrc?: string;
          kind: "track" | "artist" | "album";
          provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
          value:
            | {
                artists: Array<{ externalId?: string; name: string }>;
                coverUrl?: string;
                durationMs?: number;
                isrc?: string;
                previewUrl?: string;
                title: string;
                url?: string;
              }
            | {
                country?: string;
                debutYear?: number;
                gender?: string;
                genres: Array<string>;
                imageUrl?: string;
                members?: "solo" | "group";
                name: string;
                popularity?: number;
                url?: string;
              }
            | {
                artists: Array<{ externalId?: string; name: string }>;
                coverUrl?: string;
                releaseDate?: string;
                title: string;
                trackCount?: number;
                url?: string;
              };
        }>,
        Name
      >;
      stats: FunctionReference<
        "query",
        "internal",
        {},
        { total: number },
        Name
      >;
    };
  };
