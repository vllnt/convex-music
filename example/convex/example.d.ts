export declare const put: import("convex/server").RegisteredMutation<"public", {
    isrc?: string | undefined;
    ttlMs?: number | undefined;
    kind: "track" | "artist" | "album";
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    externalId: string;
    value: {
        isrc?: string | undefined;
        durationMs?: number | undefined;
        previewUrl?: string | undefined;
        coverUrl?: string | undefined;
        url?: string | undefined;
        title: string;
        artists: {
            externalId?: string | undefined;
            name: string;
        }[];
    } | {
        url?: string | undefined;
        popularity?: number | undefined;
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
    kind: "track" | "artist" | "album";
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    externalId: string;
}, any>;
export declare const getByIsrc: import("convex/server").RegisteredQuery<"public", {
    isrc: string;
}, any>;
export declare const invalidate: import("convex/server").RegisteredMutation<"public", {
    kind: "track" | "artist" | "album";
    provider: "spotify" | "apple" | "musicbrainz" | "wikidata" | "deezer";
    externalId: string;
}, Promise<boolean>>;
export declare const pruneExpired: import("convex/server").RegisteredMutation<"public", {}, Promise<number>>;
export declare const stats: import("convex/server").RegisteredQuery<"public", {}, Promise<{
    total: number;
}>>;
//# sourceMappingURL=example.d.ts.map