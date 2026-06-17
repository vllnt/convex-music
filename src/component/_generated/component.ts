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
    actions: {
      fetchArtist: FunctionReference<
        "action",
        "internal",
        {
          externalId: string;
          force?: boolean;
          provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        },
        null | {
          _creationTime: number;
          _id: string;
          country?: string;
          debutYear?: number;
          gender?: string;
          genres: Array<string>;
          imageUrl?: string;
          lastRepairAt?: number;
          lastSyncError?: string;
          lastSyncedAt?: number;
          members?: "solo" | "group";
          name: string;
          nameKey: string;
          nextSyncAt?: number;
          popularity?: number;
          providers: Array<{
            genres?: Array<string>;
            imageUrl?: string;
            popularity?: number;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            url?: string;
          }>;
          repairAttempts?: number;
          repairError?: string;
          repairStartedAt?: number;
          repairStatus?:
            | "clean"
            | "needs_repair"
            | "repairing"
            | "failed_repair";
          syncRetryCount?: number;
          syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
          updatedAt: number;
        },
        Name
      >;
      fetchTrack: FunctionReference<
        "action",
        "internal",
        {
          externalId: string;
          force?: boolean;
          provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        },
        null | {
          _creationTime: number;
          _id: string;
          artistIds: Array<string>;
          durationMs?: number;
          genres: Array<string>;
          isrc: string;
          lastRepairAt?: number;
          lastSyncError?: string;
          lastSyncedAt?: number;
          nextSyncAt?: number;
          popularity?: number;
          providers: Array<{
            coverUrl?: string;
            previewUrl?: string;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            url?: string;
          }>;
          repairAttempts?: number;
          repairError?: string;
          repairStartedAt?: number;
          repairStatus?:
            | "clean"
            | "needs_repair"
            | "repairing"
            | "failed_repair";
          syncRetryCount?: number;
          syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
          title: string;
          updatedAt: number;
        },
        Name
      >;
      resolveByIsrc: FunctionReference<
        "action",
        "internal",
        {
          isrc: string;
          provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        },
        null | {
          _creationTime: number;
          _id: string;
          artistIds: Array<string>;
          durationMs?: number;
          genres: Array<string>;
          isrc: string;
          lastRepairAt?: number;
          lastSyncError?: string;
          lastSyncedAt?: number;
          nextSyncAt?: number;
          popularity?: number;
          providers: Array<{
            coverUrl?: string;
            previewUrl?: string;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            url?: string;
          }>;
          repairAttempts?: number;
          repairError?: string;
          repairStartedAt?: number;
          repairStatus?:
            | "clean"
            | "needs_repair"
            | "repairing"
            | "failed_repair";
          syncRetryCount?: number;
          syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
          title: string;
          updatedAt: number;
        },
        Name
      >;
      search: FunctionReference<
        "action",
        "internal",
        {
          provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
          query: string;
          type: "artist" | "track";
        },
        Array<
          | {
              externalId: string;
              type: "artist";
              value: {
                country?: string;
                debutYear?: number;
                gender?: string;
                genres: Array<string>;
                imageUrl?: string;
                members?: "solo" | "group";
                name: string;
                popularity?: number;
                url?: string;
              };
            }
          | {
              externalId: string;
              type: "track";
              value: {
                artists: Array<{ externalId?: string; name: string }>;
                coverUrl?: string;
                durationMs?: number;
                isrc?: string;
                previewUrl?: string;
                title: string;
                url?: string;
              };
            }
        >,
        Name
      >;
    };
    catalog: {
      mutations: {
        upsertAlbum: FunctionReference<
          "mutation",
          "internal",
          {
            artistIds: Array<string>;
            coverUrl?: string;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            releaseDate?: string;
            title: string;
            trackCount?: number;
            trackIds: Array<string>;
            url?: string;
          },
          string,
          Name
        >;
        upsertArtist: FunctionReference<
          "mutation",
          "internal",
          {
            externalId: string;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            value: {
              country?: string;
              debutYear?: number;
              gender?: string;
              genres: Array<string>;
              imageUrl?: string;
              members?: "solo" | "group";
              name: string;
              popularity?: number;
              url?: string;
            };
          },
          string,
          Name
        >;
        upsertPlaylist: FunctionReference<
          "mutation",
          "internal",
          {
            coverUrl?: string;
            description?: string;
            owner?: string;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            title: string;
            trackIds: Array<string>;
            url?: string;
          },
          string,
          Name
        >;
        upsertTrack: FunctionReference<
          "mutation",
          "internal",
          {
            artistIds?: Array<string>;
            externalId: string;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            value: {
              artists: Array<{ externalId?: string; name: string }>;
              coverUrl?: string;
              durationMs?: number;
              isrc?: string;
              previewUrl?: string;
              title: string;
              url?: string;
            };
          },
          string,
          Name
        >;
      };
      queries: {
        getAlbum: FunctionReference<
          "query",
          "internal",
          { id: string },
          null | {
            _creationTime: number;
            _id: string;
            artistIds: Array<string>;
            coverUrl?: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            nextSyncAt?: number;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            releaseDate?: string;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            title: string;
            trackCount?: number;
            trackIds: Array<string>;
            updatedAt: number;
            url?: string;
          },
          Name
        >;
        getAlbumByProvider: FunctionReference<
          "query",
          "internal",
          {
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
          },
          null | {
            _creationTime: number;
            _id: string;
            artistIds: Array<string>;
            coverUrl?: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            nextSyncAt?: number;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            releaseDate?: string;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            title: string;
            trackCount?: number;
            trackIds: Array<string>;
            updatedAt: number;
            url?: string;
          },
          Name
        >;
        getArtist: FunctionReference<
          "query",
          "internal",
          { id: string },
          null | {
            _creationTime: number;
            _id: string;
            country?: string;
            debutYear?: number;
            gender?: string;
            genres: Array<string>;
            imageUrl?: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            members?: "solo" | "group";
            name: string;
            nameKey: string;
            nextSyncAt?: number;
            popularity?: number;
            providers: Array<{
              genres?: Array<string>;
              imageUrl?: string;
              popularity?: number;
              provider:
                | "spotify"
                | "apple"
                | "musicbrainz"
                | "wikidata"
                | "deezer";
              providerId: string;
              url?: string;
            }>;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            updatedAt: number;
          },
          Name
        >;
        getArtistByProvider: FunctionReference<
          "query",
          "internal",
          {
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
          },
          null | {
            _creationTime: number;
            _id: string;
            country?: string;
            debutYear?: number;
            gender?: string;
            genres: Array<string>;
            imageUrl?: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            members?: "solo" | "group";
            name: string;
            nameKey: string;
            nextSyncAt?: number;
            popularity?: number;
            providers: Array<{
              genres?: Array<string>;
              imageUrl?: string;
              popularity?: number;
              provider:
                | "spotify"
                | "apple"
                | "musicbrainz"
                | "wikidata"
                | "deezer";
              providerId: string;
              url?: string;
            }>;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            updatedAt: number;
          },
          Name
        >;
        getArtistImage: FunctionReference<
          "query",
          "internal",
          {
            policy?:
              | {
                  from:
                    | "spotify"
                    | "apple"
                    | "musicbrainz"
                    | "wikidata"
                    | "deezer";
                }
              | {
                  prefer: Array<
                    "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer"
                  >;
                };
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
          },
          null | string,
          Name
        >;
        getPlaylist: FunctionReference<
          "query",
          "internal",
          { id: string },
          null | {
            _creationTime: number;
            _id: string;
            coverUrl?: string;
            description?: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            nextSyncAt?: number;
            owner?: string;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            snapshotVersion?: string;
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            title: string;
            trackIds: Array<string>;
            updatedAt: number;
            url?: string;
          },
          Name
        >;
        getTrack: FunctionReference<
          "query",
          "internal",
          { id: string },
          null | {
            _creationTime: number;
            _id: string;
            artistIds: Array<string>;
            durationMs?: number;
            genres: Array<string>;
            isrc: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            nextSyncAt?: number;
            popularity?: number;
            providers: Array<{
              coverUrl?: string;
              previewUrl?: string;
              provider:
                | "spotify"
                | "apple"
                | "musicbrainz"
                | "wikidata"
                | "deezer";
              providerId: string;
              url?: string;
            }>;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            title: string;
            updatedAt: number;
          },
          Name
        >;
        getTrackByIsrc: FunctionReference<
          "query",
          "internal",
          { isrc: string },
          null | {
            _creationTime: number;
            _id: string;
            artistIds: Array<string>;
            durationMs?: number;
            genres: Array<string>;
            isrc: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            nextSyncAt?: number;
            popularity?: number;
            providers: Array<{
              coverUrl?: string;
              previewUrl?: string;
              provider:
                | "spotify"
                | "apple"
                | "musicbrainz"
                | "wikidata"
                | "deezer";
              providerId: string;
              url?: string;
            }>;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            title: string;
            updatedAt: number;
          },
          Name
        >;
        getTrackByProvider: FunctionReference<
          "query",
          "internal",
          {
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
          },
          null | {
            _creationTime: number;
            _id: string;
            artistIds: Array<string>;
            durationMs?: number;
            genres: Array<string>;
            isrc: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            nextSyncAt?: number;
            popularity?: number;
            providers: Array<{
              coverUrl?: string;
              previewUrl?: string;
              provider:
                | "spotify"
                | "apple"
                | "musicbrainz"
                | "wikidata"
                | "deezer";
              providerId: string;
              url?: string;
            }>;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            title: string;
            updatedAt: number;
          },
          Name
        >;
        getTrackPreview: FunctionReference<
          "query",
          "internal",
          {
            policy?:
              | {
                  from:
                    | "spotify"
                    | "apple"
                    | "musicbrainz"
                    | "wikidata"
                    | "deezer";
                }
              | {
                  prefer: Array<
                    "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer"
                  >;
                };
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
          },
          null | string,
          Name
        >;
        searchArtists: FunctionReference<
          "query",
          "internal",
          { limit?: number; query: string },
          Array<{
            _creationTime: number;
            _id: string;
            country?: string;
            debutYear?: number;
            gender?: string;
            genres: Array<string>;
            imageUrl?: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            members?: "solo" | "group";
            name: string;
            nameKey: string;
            nextSyncAt?: number;
            popularity?: number;
            providers: Array<{
              genres?: Array<string>;
              imageUrl?: string;
              popularity?: number;
              provider:
                | "spotify"
                | "apple"
                | "musicbrainz"
                | "wikidata"
                | "deezer";
              providerId: string;
              url?: string;
            }>;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            updatedAt: number;
          }>,
          Name
        >;
        searchTracks: FunctionReference<
          "query",
          "internal",
          { limit?: number; query: string },
          Array<{
            _creationTime: number;
            _id: string;
            artistIds: Array<string>;
            durationMs?: number;
            genres: Array<string>;
            isrc: string;
            lastRepairAt?: number;
            lastSyncError?: string;
            lastSyncedAt?: number;
            nextSyncAt?: number;
            popularity?: number;
            providers: Array<{
              coverUrl?: string;
              previewUrl?: string;
              provider:
                | "spotify"
                | "apple"
                | "musicbrainz"
                | "wikidata"
                | "deezer";
              providerId: string;
              url?: string;
            }>;
            repairAttempts?: number;
            repairError?: string;
            repairStartedAt?: number;
            repairStatus?:
              | "clean"
              | "needs_repair"
              | "repairing"
              | "failed_repair";
            syncRetryCount?: number;
            syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
            title: string;
            updatedAt: number;
          }>,
          Name
        >;
        selectEligible: FunctionReference<
          "query",
          "internal",
          {
            excludeIds?: Array<string>;
            kind: "artist" | "track";
            limit: number;
            salt?: string;
            scanLimit?: number;
          },
          Array<
            | {
                _creationTime: number;
                _id: string;
                country?: string;
                debutYear?: number;
                gender?: string;
                genres: Array<string>;
                imageUrl?: string;
                lastRepairAt?: number;
                lastSyncError?: string;
                lastSyncedAt?: number;
                members?: "solo" | "group";
                name: string;
                nameKey: string;
                nextSyncAt?: number;
                popularity?: number;
                providers: Array<{
                  genres?: Array<string>;
                  imageUrl?: string;
                  popularity?: number;
                  provider:
                    | "spotify"
                    | "apple"
                    | "musicbrainz"
                    | "wikidata"
                    | "deezer";
                  providerId: string;
                  url?: string;
                }>;
                repairAttempts?: number;
                repairError?: string;
                repairStartedAt?: number;
                repairStatus?:
                  | "clean"
                  | "needs_repair"
                  | "repairing"
                  | "failed_repair";
                syncRetryCount?: number;
                syncStatus?:
                  | "pending"
                  | "running"
                  | "synced"
                  | "failed"
                  | "stale";
                updatedAt: number;
              }
            | {
                _creationTime: number;
                _id: string;
                artistIds: Array<string>;
                durationMs?: number;
                genres: Array<string>;
                isrc: string;
                lastRepairAt?: number;
                lastSyncError?: string;
                lastSyncedAt?: number;
                nextSyncAt?: number;
                popularity?: number;
                providers: Array<{
                  coverUrl?: string;
                  previewUrl?: string;
                  provider:
                    | "spotify"
                    | "apple"
                    | "musicbrainz"
                    | "wikidata"
                    | "deezer";
                  providerId: string;
                  url?: string;
                }>;
                repairAttempts?: number;
                repairError?: string;
                repairStartedAt?: number;
                repairStatus?:
                  | "clean"
                  | "needs_repair"
                  | "repairing"
                  | "failed_repair";
                syncRetryCount?: number;
                syncStatus?:
                  | "pending"
                  | "running"
                  | "synced"
                  | "failed"
                  | "stale";
                title: string;
                updatedAt: number;
              }
          >,
          Name
        >;
      };
    };
    config: {
      mutations: {
        configure: FunctionReference<
          "mutation",
          "internal",
          {
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            secrets: Record<string, string>;
          },
          null,
          Name
        >;
      };
    };
    imports: {
      actions: {
        importArtist: FunctionReference<
          "action",
          "internal",
          {
            mode?: "import" | "refresh" | "reimport" | "repair";
            name?: string;
            priority?: "high" | "normal" | "low";
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId?: string;
            targetMode: "name" | "providerId";
            tracks?: "none" | "top" | "all";
            withTracks?: boolean;
          },
          {
            requestId: string;
            status:
              | "queued"
              | "claimed"
              | "running"
              | "retry_waiting"
              | "completed"
              | "failed"
              | "canceled"
              | "stale";
          },
          Name
        >;
        importPlaylist: FunctionReference<
          "action",
          "internal",
          {
            limit?: number;
            mode?: "import" | "refresh" | "reimport" | "repair";
            priority?: "high" | "normal" | "low";
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
          },
          {
            requestId: string;
            status:
              | "queued"
              | "claimed"
              | "running"
              | "retry_waiting"
              | "completed"
              | "failed"
              | "canceled"
              | "stale";
          },
          Name
        >;
        importTrack: FunctionReference<
          "action",
          "internal",
          {
            mode?: "import" | "refresh" | "reimport" | "repair";
            priority?: "high" | "normal" | "low";
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
          },
          {
            requestId: string;
            status:
              | "queued"
              | "claimed"
              | "running"
              | "retry_waiting"
              | "completed"
              | "failed"
              | "canceled"
              | "stale";
          },
          Name
        >;
        runArtistImport: FunctionReference<
          "action",
          "internal",
          {
            name: string;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            requestId: string;
            targetMode: "name" | "providerId";
            tracks?: "none" | "top" | "all";
            withTracks?: boolean;
          },
          {
            status:
              | "queued"
              | "claimed"
              | "running"
              | "retry_waiting"
              | "completed"
              | "failed"
              | "canceled"
              | "stale";
          },
          Name
        >;
        runPlaylistImport: FunctionReference<
          "action",
          "internal",
          {
            limit?: number;
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            requestId: string;
          },
          {
            status:
              | "queued"
              | "claimed"
              | "running"
              | "retry_waiting"
              | "completed"
              | "failed"
              | "canceled"
              | "stale";
          },
          Name
        >;
        runTrackImport: FunctionReference<
          "action",
          "internal",
          {
            provider:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId: string;
            requestId: string;
          },
          {
            status:
              | "queued"
              | "claimed"
              | "running"
              | "retry_waiting"
              | "completed"
              | "failed"
              | "canceled"
              | "stale";
          },
          Name
        >;
      };
      mutations: {
        createRequest: FunctionReference<
          "mutation",
          "internal",
          {
            entityId?: string;
            entityType: "artist" | "track" | "playlist";
            isrc?: string;
            name?: string;
            priority?: "high" | "normal" | "low";
            provider?:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId?: string;
            providerScope: string;
            requestType: "import" | "refresh" | "reimport" | "repair";
            targetMode: "name" | "url" | "isrc" | "providerId" | "entityId";
            url?: string;
            withTracks?: boolean;
          },
          { deduped: boolean; requestId: string },
          Name
        >;
      };
      queries: {
        getRequest: FunctionReference<
          "query",
          "internal",
          { requestId: string },
          null | {
            _creationTime: number;
            _id: string;
            dedupeKey: string;
            entityId?: string;
            entityType: "artist" | "track" | "playlist";
            errorSummary?: string;
            finishedAt?: number;
            isrc?: string;
            name?: string;
            nextAttemptAt?: number;
            priority: "high" | "normal" | "low";
            provider?:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId?: string;
            providerScope: string;
            requestType: "import" | "refresh" | "reimport" | "repair";
            requestedAt: number;
            resolvedArtistId?: string;
            resolvedPlaylistId?: string;
            resolvedTrackId?: string;
            resultSummary?: string;
            retryCount: number;
            startedAt?: number;
            status:
              | "queued"
              | "claimed"
              | "running"
              | "retry_waiting"
              | "completed"
              | "failed"
              | "canceled"
              | "stale";
            targetMode: "name" | "url" | "isrc" | "providerId" | "entityId";
            updatedAt: number;
            url?: string;
            withTracks?: boolean;
            workflowId?: string;
          },
          Name
        >;
        listRequests: FunctionReference<
          "query",
          "internal",
          {
            limit?: number;
            status:
              | "queued"
              | "claimed"
              | "running"
              | "retry_waiting"
              | "completed"
              | "failed"
              | "canceled"
              | "stale";
          },
          Array<{
            _creationTime: number;
            _id: string;
            dedupeKey: string;
            entityId?: string;
            entityType: "artist" | "track" | "playlist";
            errorSummary?: string;
            finishedAt?: number;
            isrc?: string;
            name?: string;
            nextAttemptAt?: number;
            priority: "high" | "normal" | "low";
            provider?:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            providerId?: string;
            providerScope: string;
            requestType: "import" | "refresh" | "reimport" | "repair";
            requestedAt: number;
            resolvedArtistId?: string;
            resolvedPlaylistId?: string;
            resolvedTrackId?: string;
            resultSummary?: string;
            retryCount: number;
            startedAt?: number;
            status:
              | "queued"
              | "claimed"
              | "running"
              | "retry_waiting"
              | "completed"
              | "failed"
              | "canceled"
              | "stale";
            targetMode: "name" | "url" | "isrc" | "providerId" | "entityId";
            updatedAt: number;
            url?: string;
            withTracks?: boolean;
            workflowId?: string;
          }>,
          Name
        >;
      };
    };
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
    sources: {
      actions: {
        consumeBudget: FunctionReference<
          "action",
          "internal",
          { budget: "autoImport" | "refresh"; count: number },
          boolean,
          Name
        >;
        runAutoImport: FunctionReference<
          "action",
          "internal",
          { limit?: number; now?: number },
          { imported: number; skipped: number },
          Name
        >;
        runRefresh: FunctionReference<
          "action",
          "internal",
          { kind: "artist" | "track"; limit?: number },
          { refreshed: number },
          Name
        >;
      };
      mutations: {
        addSource: FunctionReference<
          "mutation",
          "internal",
          {
            by: "name" | "url" | "isrc" | "providerId" | "entityId";
            cadenceMs?: number;
            enabled?: boolean;
            kind: "artist" | "track" | "playlist";
            provider?:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            value: string;
            withTracks?: boolean;
          },
          string,
          Name
        >;
        removeSource: FunctionReference<
          "mutation",
          "internal",
          { sourceId: string },
          null,
          Name
        >;
        setSourceEnabled: FunctionReference<
          "mutation",
          "internal",
          { enabled: boolean; sourceId: string },
          null,
          Name
        >;
        touchSource: FunctionReference<
          "mutation",
          "internal",
          { now: number; sourceId: string },
          null,
          Name
        >;
      };
      queries: {
        listSources: FunctionReference<
          "query",
          "internal",
          { enabledOnly?: boolean; limit?: number },
          Array<{
            _creationTime: number;
            _id: string;
            by: "name" | "url" | "isrc" | "providerId" | "entityId";
            cadenceMs?: number;
            createdAt: number;
            enabled: boolean;
            kind: "artist" | "track" | "playlist";
            lastImportedAt?: number;
            provider?:
              | "spotify"
              | "apple"
              | "musicbrainz"
              | "wikidata"
              | "deezer";
            updatedAt: number;
            value: string;
            withTracks?: boolean;
          }>,
          Name
        >;
      };
    };
    sync: {
      mutations: {
        markStale: FunctionReference<
          "mutation",
          "internal",
          { kind: "artist" | "track"; limit?: number; now?: number },
          number,
          Name
        >;
      };
      queries: {
        listStale: FunctionReference<
          "query",
          "internal",
          { kind: "artist" | "track"; limit?: number },
          | Array<{
              _creationTime: number;
              _id: string;
              country?: string;
              debutYear?: number;
              gender?: string;
              genres: Array<string>;
              imageUrl?: string;
              lastRepairAt?: number;
              lastSyncError?: string;
              lastSyncedAt?: number;
              members?: "solo" | "group";
              name: string;
              nameKey: string;
              nextSyncAt?: number;
              popularity?: number;
              providers: Array<{
                genres?: Array<string>;
                imageUrl?: string;
                popularity?: number;
                provider:
                  | "spotify"
                  | "apple"
                  | "musicbrainz"
                  | "wikidata"
                  | "deezer";
                providerId: string;
                url?: string;
              }>;
              repairAttempts?: number;
              repairError?: string;
              repairStartedAt?: number;
              repairStatus?:
                | "clean"
                | "needs_repair"
                | "repairing"
                | "failed_repair";
              syncRetryCount?: number;
              syncStatus?:
                | "pending"
                | "running"
                | "synced"
                | "failed"
                | "stale";
              updatedAt: number;
            }>
          | Array<{
              _creationTime: number;
              _id: string;
              artistIds: Array<string>;
              durationMs?: number;
              genres: Array<string>;
              isrc: string;
              lastRepairAt?: number;
              lastSyncError?: string;
              lastSyncedAt?: number;
              nextSyncAt?: number;
              popularity?: number;
              providers: Array<{
                coverUrl?: string;
                previewUrl?: string;
                provider:
                  | "spotify"
                  | "apple"
                  | "musicbrainz"
                  | "wikidata"
                  | "deezer";
                providerId: string;
                url?: string;
              }>;
              repairAttempts?: number;
              repairError?: string;
              repairStartedAt?: number;
              repairStatus?:
                | "clean"
                | "needs_repair"
                | "repairing"
                | "failed_repair";
              syncRetryCount?: number;
              syncStatus?:
                | "pending"
                | "running"
                | "synced"
                | "failed"
                | "stale";
              title: string;
              updatedAt: number;
            }>,
          Name
        >;
      };
    };
  };
