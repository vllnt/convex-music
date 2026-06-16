# ROADMAP — @vllnt/convex-music

A provider-neutral, cached music catalog as a Convex component. This roadmap tracks **this
component's** plan only (the hub `ROADMAP.md` tracks fleet creation/programs). Convention: phases
are immutable kebab-case outcome slugs; tasks have stable `slug.N` ids; history is never deleted —
mark status, don't remove.

**Status vocabulary:** `planned` · `in-progress` · `done` · `blocked` · `dropped`

## Consumers (Rule of Three — met)

| App | Needs | Mode |
|-----|-------|------|
| songtrivia | track + artist + album search; getTrack/Artist/Album/Playlist; ISRC | live, reference consumer |
| spotzic | artist facts (genre, popularity, nationality, gender, members, debut) | seed + editorial |
| heardzic | track search + getTrack + `previewUrl` (audio) | ops-authored |
| bandzic | getTrack + `previewUrl`/clip (audio) | ops-authored |

`harmonies` and `wordzic` are NOT consumers (word games — no catalog data).

## Design decisions (load-bearing)

- **Cache, never replace.** The component is an acceleration layer in front of providers, not a
  system of record. Hosts keep their own curated/editorial/gameplay tables and read through the
  cache. Keeps the component domain-neutral.
- **Factual vs editorial.** The component serves *factual* provider data (per-provider, cached).
  Editorial precedence, overrides, `sourceRefs`, and the gameplay-frozen snapshot are the host's.
- **Live vs synced popularity.** The component serves *live* popularity (cache-through); the host
  freezes a *synced* snapshot for deterministic gameplay grading.
- **Per-deployment cache.** Sandboxed per mount — dedupes calls within one app, not across apps.
- **V8 only.** A component runs in V8 → Apple ES256 JWT uses Web Crypto, not `jsonwebtoken`.
- **Official children.** Retry/rate-limit/response-cache compose `@convex-dev/*`, never hand-rolled.
- **Audio + image binaries are the host's.** The component caches metadata + URLs (and resolves an
  image policy); downloading/storing/licensing bytes is the host's concern.

---

## cache-core — `done`

The sandboxed cache substrate: TTL'd normalized entries, keyed lookups, ISRC cross-ref, prune.

- `cache-core.1` `done` — `cacheEntries` schema (`by_lookup`, `by_isrc`, `by_expiry`) + typed `*Value` validators.
- `cache-core.2` `done` — mutations: `put` (upsert + TTL), `invalidate`, `pruneExpired`.
- `cache-core.3` `done` — queries: `get` (read-time expiry), `getByIsrc`, `stats`.
- `cache-core.4` `done` — `Music` client class + `example/` harness, 100% coverage gate green.

## provider-adapters — `planned`

One normalize-to-cache adapter per provider, behind a single interface. No host coupling.

- `provider-adapters.1` `planned` — adapter interface + normalized mappers (track/artist/album).
- `provider-adapters.2` `planned` — Spotify adapter (client-credentials OAuth; token cached via `@convex-dev/action-cache`).
- `provider-adapters.3` `planned` — Apple Music adapter (ES256 developer JWT via **Web Crypto**, zero-dep — port from `jsonwebtoken`).
- `provider-adapters.4` `planned` — MusicBrainz adapter (nationality/country, gender, `members` solo/group, debut/begin-date).
- `provider-adapters.5` `planned` — Wikidata adapter (overlap + gap-fill for artist facts).
- `provider-adapters.6` `planned` — Deezer adapter.

## read-through-fetch — `planned`

Fetch-on-miss verbs that fill the cache and return normalized facts. Compose official children.

- `read-through-fetch.1` `planned` — `search({ provider?, query, types })` (track + artist).
- `read-through-fetch.2` `planned` — `getTrack` / `getArtist` / `getAlbum` (cache-through).
- `read-through-fetch.3` `planned` — `resolveByIsrc` cross-provider track resolution.
- `read-through-fetch.4` `planned` — wire `@convex-dev/action-retrier` (backoff) + `@convex-dev/rate-limiter` (429) + `@convex-dev/workpool` (batch concurrency).
- `read-through-fetch.5` `planned` — live vs cached popularity option (`live: true` bypass / short TTL).
- `read-through-fetch.6` `planned` — mount config: enabled providers, secret env-var names, market/locale, per-entity TTLs, rate limits, batch sizes (sensible zero-config defaults).

## artist-image-auto-sync — `planned`

Configurable artist profile-image resolution across providers + scheduled refresh. (Owner request.)

- `artist-image-auto-sync.1` `planned` — cache per-provider artist image URLs (Spotify images, Apple artwork, Wikidata image, …) alongside the artist entry.
- `artist-image-auto-sync.2` `planned` — **provider-selection policy**: ordered preference (e.g. `["spotify","apple","wikidata"]`) + `strategy` (`first-available` | `highest-resolution`) + optional `fallback`. Configurable at mount and overridable per call. Resolves a single `profileImageUrl`.
- `artist-image-auto-sync.3` `planned` — `getArtistImage(key, { policyOverride? })` returns the policy-resolved URL.
- `artist-image-auto-sync.4` `planned` — auto-sync cron: idempotent, per-mount, re-fetches images on a configurable cadence and re-applies the policy (caches URLs only; binary storage stays host-side).
- `artist-image-auto-sync.5` `planned` — front-tooling analysis: a reactive `useArtistImage` hook only if a consumer renders catalog images (per the Front-end tooling decision).

## prune-cron — `planned`

- `prune-cron.1` `planned` — in-component idempotent cron calling `pruneExpired` on a configurable cadence (mount-safe, per-instance).

## consumer-migration — `planned`

Land each real consumer on the component; songtrivia is the reference.

- `consumer-migration.1` `planned` — migrate songtrivia's `music/providers/*` onto the component (track-centric; reference consumer).
- `consumer-migration.2` `planned` — spotzic artist-catalog seed on the component (artist facts; host owns editorial merge + frozen snapshot).
- `consumer-migration.3` `planned` — heardzic ops track-search + `getTrack` (audio source/licensing host-side).
- `consumer-migration.4` `planned` — bandzic ops `getTrack` + clip handling (host-side audio).

## release — `planned`

- `release.1` `planned` — make repo public when audit-clean + CI-green (currently private).
- `release.2` `planned` — add the README Components index row in the hub.
- `release.3` `planned` — first stable release (lift the canary-only `0.1.0` hold) once a consumer is live.
