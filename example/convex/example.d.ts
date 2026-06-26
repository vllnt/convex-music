export declare const put: import("convex/server").RegisteredMutation<"public", {
    isrc?: string | undefined;
    ttlMs?: number | undefined;
    externalId: string;
    kind: "track" | "artist" | "album";
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    value: {
        isrc?: string | undefined;
        popularity?: number | undefined;
        durationMs?: number | undefined;
        previewUrl?: string | undefined;
        coverUrl?: string | undefined;
        url?: string | undefined;
        albumId?: string | undefined;
        title: string;
        artists: {
            externalId?: string | undefined;
            name: string;
        }[];
        genres: string[];
    } | {
        popularity?: number | undefined;
        url?: string | undefined;
        imageUrl?: string | undefined;
        country?: string | undefined;
        gender?: string | undefined;
        debutYear?: number | undefined;
        members?: "solo" | "group" | undefined;
        name: string;
        genres: string[];
    } | {
        coverUrl?: string | undefined;
        url?: string | undefined;
        releaseDate?: string | undefined;
        trackCount?: number | undefined;
        title: string;
        artists: {
            externalId?: string | undefined;
            name: string;
        }[];
    };
}, Promise<string>>;
export declare const get: import("convex/server").RegisteredQuery<"public", {
    externalId: string;
    kind: "track" | "artist" | "album";
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
}, Promise<import("../../src/client/types.js").CacheEntry | null>>;
export declare const getByIsrc: import("convex/server").RegisteredQuery<"public", {
    isrc: string;
}, Promise<import("../../src/client/types.js").CacheEntry[]>>;
export declare const invalidate: import("convex/server").RegisteredMutation<"public", {
    externalId: string;
    kind: "track" | "artist" | "album";
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
}, Promise<boolean>>;
export declare const pruneExpired: import("convex/server").RegisteredMutation<"public", {}, Promise<number>>;
export declare const stats: import("convex/server").RegisteredQuery<"public", {}, Promise<{
    total: number;
}>>;
export declare const upsertArtist: import("convex/server").RegisteredMutation<"public", {
    externalId: string;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    value: {
        popularity?: number | undefined;
        url?: string | undefined;
        imageUrl?: string | undefined;
        country?: string | undefined;
        gender?: string | undefined;
        debutYear?: number | undefined;
        members?: "solo" | "group" | undefined;
        name: string;
        genres: string[];
    };
}, Promise<string>>;
export declare const upsertTrack: import("convex/server").RegisteredMutation<"public", {
    artistIds?: string[] | undefined;
    externalId: string;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    value: {
        isrc?: string | undefined;
        popularity?: number | undefined;
        durationMs?: number | undefined;
        previewUrl?: string | undefined;
        coverUrl?: string | undefined;
        url?: string | undefined;
        albumId?: string | undefined;
        title: string;
        artists: {
            externalId?: string | undefined;
            name: string;
        }[];
        genres: string[];
    };
}, Promise<string>>;
export declare const upsertPlaylist: import("convex/server").RegisteredMutation<"public", {
    coverUrl?: string | undefined;
    url?: string | undefined;
    description?: string | undefined;
    owner?: string | undefined;
    title: string;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
    trackIds: string[];
}, Promise<string>>;
export declare const upsertAlbum: import("convex/server").RegisteredMutation<"public", {
    coverUrl?: string | undefined;
    url?: string | undefined;
    releaseDate?: string | undefined;
    trackCount?: number | undefined;
    title: string;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
    artistIds: string[];
    trackIds: string[];
}, Promise<string>>;
export declare const getAlbum: import("convex/server").RegisteredQuery<"public", {
    id: string;
}, Promise<{
    coverUrl?: string | undefined;
    url?: string | undefined;
    releaseDate?: string | undefined;
    trackCount?: number | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    title: string;
    _id: string;
    _creationTime: number;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
    updatedAt: number;
    artistIds: string[];
    trackIds: string[];
} | null>>;
export declare const getAlbumByProvider: import("convex/server").RegisteredQuery<"public", {
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
}, Promise<{
    coverUrl?: string | undefined;
    url?: string | undefined;
    releaseDate?: string | undefined;
    trackCount?: number | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    title: string;
    _id: string;
    _creationTime: number;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
    updatedAt: number;
    artistIds: string[];
    trackIds: string[];
} | null>>;
export declare const getArtist: import("convex/server").RegisteredQuery<"public", {
    id: string;
}, Promise<{
    popularity?: number | undefined;
    imageUrl?: string | undefined;
    country?: string | undefined;
    gender?: string | undefined;
    debutYear?: number | undefined;
    members?: "solo" | "group" | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    name: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    nameKey: string;
    providers: {
        genres?: string[] | undefined;
        popularity?: number | undefined;
        url?: string | undefined;
        imageUrl?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
} | null>>;
export declare const getTrack: import("convex/server").RegisteredQuery<"public", {
    id: string;
}, Promise<{
    popularity?: number | undefined;
    durationMs?: number | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    title: string;
    isrc: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    providers: {
        previewUrl?: string | undefined;
        coverUrl?: string | undefined;
        url?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
    artistIds: string[];
} | null>>;
export declare const getPlaylist: import("convex/server").RegisteredQuery<"public", {
    id: string;
}, Promise<{
    coverUrl?: string | undefined;
    url?: string | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    description?: string | undefined;
    owner?: string | undefined;
    snapshotVersion?: string | undefined;
    title: string;
    _id: string;
    _creationTime: number;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
    updatedAt: number;
    trackIds: string[];
} | null>>;
export declare const getTrackByIsrc: import("convex/server").RegisteredQuery<"public", {
    isrc: string;
}, Promise<{
    popularity?: number | undefined;
    durationMs?: number | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    title: string;
    isrc: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    providers: {
        previewUrl?: string | undefined;
        coverUrl?: string | undefined;
        url?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
    artistIds: string[];
} | null>>;
export declare const getArtistImage: import("convex/server").RegisteredQuery<"public", {
    policy?: {
        from: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    } | {
        prefer: ("spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer")[];
    } | undefined;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
}, Promise<string | null>>;
export declare const getTrackPreview: import("convex/server").RegisteredQuery<"public", {
    policy?: {
        from: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    } | {
        prefer: ("spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer")[];
    } | undefined;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
}, Promise<string | null>>;
export declare const searchArtists: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
    query: string;
}, Promise<{
    popularity?: number | undefined;
    imageUrl?: string | undefined;
    country?: string | undefined;
    gender?: string | undefined;
    debutYear?: number | undefined;
    members?: "solo" | "group" | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    name: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    nameKey: string;
    providers: {
        genres?: string[] | undefined;
        popularity?: number | undefined;
        url?: string | undefined;
        imageUrl?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
}[]>>;
export declare const searchTracks: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
    query: string;
}, Promise<{
    popularity?: number | undefined;
    durationMs?: number | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    title: string;
    isrc: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    providers: {
        previewUrl?: string | undefined;
        coverUrl?: string | undefined;
        url?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
    artistIds: string[];
}[]>>;
export declare const selectEligible: import("convex/server").RegisteredQuery<"public", {
    excludeIds?: string[] | undefined;
    salt?: string | undefined;
    scanLimit?: number | undefined;
    kind: "track" | "artist";
    limit: number;
}, Promise<({
    popularity?: number | undefined;
    imageUrl?: string | undefined;
    country?: string | undefined;
    gender?: string | undefined;
    debutYear?: number | undefined;
    members?: "solo" | "group" | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    name: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    nameKey: string;
    providers: {
        genres?: string[] | undefined;
        popularity?: number | undefined;
        url?: string | undefined;
        imageUrl?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
} | {
    popularity?: number | undefined;
    durationMs?: number | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    title: string;
    isrc: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    providers: {
        previewUrl?: string | undefined;
        coverUrl?: string | undefined;
        url?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
    artistIds: string[];
})[]>>;
export declare const fetchArtist: import("convex/server").RegisteredAction<"public", {
    force?: boolean | undefined;
    externalId: string;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
}, Promise<{
    popularity?: number | undefined;
    imageUrl?: string | undefined;
    country?: string | undefined;
    gender?: string | undefined;
    debutYear?: number | undefined;
    members?: "solo" | "group" | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    name: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    nameKey: string;
    providers: {
        genres?: string[] | undefined;
        popularity?: number | undefined;
        url?: string | undefined;
        imageUrl?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
} | null>>;
export declare const fetchTrack: import("convex/server").RegisteredAction<"public", {
    force?: boolean | undefined;
    externalId: string;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
}, Promise<{
    popularity?: number | undefined;
    durationMs?: number | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    title: string;
    isrc: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    providers: {
        previewUrl?: string | undefined;
        coverUrl?: string | undefined;
        url?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
    artistIds: string[];
} | null>>;
export declare const search: import("convex/server").RegisteredAction<"public", {
    type: "track" | "artist";
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    query: string;
}, Promise<import("../../src/client/types.js").SearchHit[]>>;
export declare const resolveByIsrc: import("convex/server").RegisteredAction<"public", {
    isrc: string;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
}, Promise<{
    popularity?: number | undefined;
    durationMs?: number | undefined;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair" | undefined;
    repairAttempts?: number | undefined;
    repairError?: string | undefined;
    lastRepairAt?: number | undefined;
    repairStartedAt?: number | undefined;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale" | undefined;
    syncRetryCount?: number | undefined;
    lastSyncError?: string | undefined;
    nextSyncAt?: number | undefined;
    lastSyncedAt?: number | undefined;
    title: string;
    isrc: string;
    genres: string[];
    _id: string;
    _creationTime: number;
    providers: {
        previewUrl?: string | undefined;
        coverUrl?: string | undefined;
        url?: string | undefined;
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
    }[];
    updatedAt: number;
    artistIds: string[];
} | null>>;
export declare const configure: import("convex/server").RegisteredMutation<"public", {
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    secrets: Record<string, string>;
}, Promise<null>>;
export declare const createImportRequest: import("convex/server").RegisteredMutation<"public", {
    name?: string | undefined;
    isrc?: string | undefined;
    url?: string | undefined;
    provider?: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer" | undefined;
    providerId?: string | undefined;
    entityId?: string | undefined;
    withTracks?: boolean | undefined;
    priority?: "high" | "normal" | "low" | undefined;
    entityType: "track" | "artist" | "album" | "playlist";
    requestType: "import" | "refresh" | "reimport" | "repair";
    targetMode: "name" | "isrc" | "url" | "providerId" | "entityId";
    providerScope: string;
}, Promise<{
    deduped: boolean;
    requestId: string;
    status: "queued" | "claimed" | "running" | "retry_waiting" | "completed" | "failed" | "canceled" | "stale";
}>>;
export declare const getImportRequest: import("convex/server").RegisteredQuery<"public", {
    requestId: string;
}, Promise<{
    _creationTime: number;
    _id: string;
    dedupeKey: string;
    entityId?: string;
    entityType: "artist" | "track" | "playlist" | "album";
    errorSummary?: string;
    finishedAt?: number;
    isrc?: string;
    name?: string;
    nextAttemptAt?: number;
    priority: "high" | "normal" | "low";
    provider?: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId?: string;
    providerScope: string;
    requestType: "import" | "refresh" | "reimport" | "repair";
    requestedAt: number;
    resolvedAlbumId?: string;
    resolvedArtistId?: string;
    resolvedPlaylistId?: string;
    resolvedTrackId?: string;
    resultSummary?: string;
    retryCount: number;
    startedAt?: number;
    status: "queued" | "claimed" | "running" | "retry_waiting" | "completed" | "failed" | "canceled" | "stale";
    targetMode: "name" | "url" | "isrc" | "providerId" | "entityId";
    updatedAt: number;
    url?: string;
    withTracks?: boolean;
} | null>>;
export declare const listImportRequests: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
    status: "running" | "failed" | "stale" | "queued" | "claimed" | "retry_waiting" | "completed" | "canceled";
}, Promise<{
    _creationTime: number;
    _id: string;
    dedupeKey: string;
    entityId?: string;
    entityType: "artist" | "track" | "playlist" | "album";
    errorSummary?: string;
    finishedAt?: number;
    isrc?: string;
    name?: string;
    nextAttemptAt?: number;
    priority: "high" | "normal" | "low";
    provider?: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId?: string;
    providerScope: string;
    requestType: "import" | "refresh" | "reimport" | "repair";
    requestedAt: number;
    resolvedAlbumId?: string;
    resolvedArtistId?: string;
    resolvedPlaylistId?: string;
    resolvedTrackId?: string;
    resultSummary?: string;
    retryCount: number;
    startedAt?: number;
    status: "queued" | "claimed" | "running" | "retry_waiting" | "completed" | "failed" | "canceled" | "stale";
    targetMode: "name" | "url" | "isrc" | "providerId" | "entityId";
    updatedAt: number;
    url?: string;
    withTracks?: boolean;
}[]>>;
export declare const importArtist: import("convex/server").RegisteredAction<"public", {
    name?: string | undefined;
    providerId?: string | undefined;
    tracks?: "none" | "top" | "all" | undefined;
    withTracks?: boolean | undefined;
    mode?: "import" | "refresh" | "reimport" | "repair" | undefined;
    priority?: "high" | "normal" | "low" | undefined;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    targetMode: "name" | "providerId";
}, Promise<import("../../src/client/index.js").ImportResult>>;
export declare const runArtistImport: import("convex/server").RegisteredAction<"public", {
    tracks?: "none" | "top" | "all" | undefined;
    withTracks?: boolean | undefined;
    name: string;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
    targetMode: "name" | "providerId";
    requestId: string;
}, Promise<{
    status: "queued" | "claimed" | "running" | "retry_waiting" | "completed" | "failed" | "canceled" | "stale";
}>>;
export declare const importTrack: import("convex/server").RegisteredAction<"public", {
    mode?: "import" | "refresh" | "reimport" | "repair" | undefined;
    priority?: "high" | "normal" | "low" | undefined;
    withAlbum?: boolean | undefined;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
}, Promise<import("../../src/client/index.js").ImportResult>>;
export declare const importPlaylist: import("convex/server").RegisteredAction<"public", {
    mode?: "import" | "refresh" | "reimport" | "repair" | undefined;
    priority?: "high" | "normal" | "low" | undefined;
    limit?: number | undefined;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
}, Promise<import("../../src/client/index.js").ImportResult>>;
export declare const importAlbum: import("convex/server").RegisteredAction<"public", {
    mode?: "import" | "refresh" | "reimport" | "repair" | undefined;
    priority?: "high" | "normal" | "low" | undefined;
    limit?: number | undefined;
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    providerId: string;
}, Promise<import("../../src/client/index.js").ImportResult>>;
export declare const addSource: import("convex/server").RegisteredMutation<"public", {
    provider?: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer" | undefined;
    withTracks?: boolean | undefined;
    cadenceMs?: number | undefined;
    enabled?: boolean | undefined;
    kind: "track" | "artist" | "album" | "playlist";
    value: string;
    by: "name" | "isrc" | "url" | "providerId" | "entityId";
}, Promise<string>>;
export declare const removeSource: import("convex/server").RegisteredMutation<"public", {
    sourceId: string;
}, Promise<null>>;
export declare const setSourceEnabled: import("convex/server").RegisteredMutation<"public", {
    enabled: boolean;
    sourceId: string;
}, Promise<null>>;
export declare const listSources: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
    enabledOnly?: boolean | undefined;
}, Promise<{
    _creationTime: number;
    _id: string;
    by: "name" | "url" | "isrc" | "providerId" | "entityId";
    cadenceMs?: number;
    createdAt: number;
    enabled: boolean;
    kind: "artist" | "track" | "playlist" | "album";
    lastImportedAt?: number;
    provider?: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    updatedAt: number;
    value: string;
    withTracks?: boolean;
}[]>>;
export declare const markStale: import("convex/server").RegisteredMutation<"public", {
    limit?: number | undefined;
    now?: number | undefined;
    kind: "track" | "artist";
}, Promise<number>>;
export declare const runAutoImport: import("convex/server").RegisteredAction<"public", {
    limit?: number | undefined;
    now?: number | undefined;
}, Promise<{
    imported: number;
    skipped: number;
}>>;
export declare const runRefresh: import("convex/server").RegisteredAction<"public", {
    limit?: number | undefined;
    kind: "track" | "artist";
}, Promise<{
    refreshed: number;
}>>;
export declare const recoverStuckSyncs: import("convex/server").RegisteredMutation<"public", {
    limit?: number | undefined;
    now?: number | undefined;
    leaseMs?: number | undefined;
    kind: "track" | "artist";
}, Promise<number>>;
export declare const consumeBudget: import("convex/server").RegisteredAction<"public", {
    budget: "refresh" | "autoImport";
    count: number;
}, Promise<boolean>>;
export declare const listStale: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
    kind: "track" | "artist";
}, Promise<{
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
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
        url?: string;
    }>;
    repairAttempts?: number;
    repairError?: string;
    repairStartedAt?: number;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair";
    syncRetryCount?: number;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
    updatedAt: number;
}[] | {
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
        provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
        providerId: string;
        url?: string;
    }>;
    repairAttempts?: number;
    repairError?: string;
    repairStartedAt?: number;
    repairStatus?: "clean" | "needs_repair" | "repairing" | "failed_repair";
    syncRetryCount?: number;
    syncStatus?: "pending" | "running" | "synced" | "failed" | "stale";
    title: string;
    updatedAt: number;
}[]>>;
/** Host setup: read deployment env vars and configure the component once. */
export declare const configureFromEnv: import("convex/server").RegisteredAction<"public", {}, Promise<null>>;
//# sourceMappingURL=example.d.ts.map