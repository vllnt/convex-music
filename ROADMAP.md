# ROADMAP — @vllnt/convex-music

A provider-neutral music **catalog** Convex component: it owns a durable music database
(artists / tracks / playlists, modeled on songtrivia's proven shape but generic) **plus** a
provider-fetch cache, and runs the import/sync/repair engine over its own tables. This roadmap
tracks **this component's** plan only (the hub `ROADMAP.md` tracks fleet creation/programs).
Convention: phases are immutable kebab-case outcome slugs; tasks have stable `slug.N` ids; history
is never deleted — mark status, don't remove.

**Status vocabulary:** `planned` · `in-progress` · `done` · `blocked` · `dropped`

## Consumers (Rule of Three — met)

| App | Needs | Mode |
|-----|-------|------|
| songtrivia | tracks + artists + playlists catalog; getTrack/Artist/Album/Playlist; ISRC | live, reference consumer |
| spotzic | artist facts (genre, popularity, nationality, gender, members, debut) | seed + editorial |
| heardzic | tracks + `previewUrl` (audio) | ops-authored |
| bandzic | tracks + `previewUrl`/clip (audio) | ops-authored |

`harmonies` and `wordzic` are NOT consumers (word games — no catalog data).

## Design decisions (load-bearing)

- **Owns the catalog (cache + music database).** The component holds durable `artists` / `tracks` /
  `playlists` tables — the music database — populated from providers (the cache) and read by hosts
  via API. It is the system of record for the **factual catalog**, not just a TTL cache. (This
  supersedes the earlier "cache, never replace": the host no longer keeps its own copy of the raw
  catalog — it reads from the component.)
- **Tier-0 boundary — what stays host-side.** To remain a horizontal music-catalog component (not a
  game-specific store), the host keeps: gameplay (puzzles, guesses, stats), **editorial overrides +
  `sourceRefs` + the frozen gameplay snapshot**, and game **categories / attribution / genre→category
  taxonomy**. Hosts reference catalog rows by id / ISRC. If app-specific import rules can't be
  expressed as config, that layer is host-side or becomes a Tier-1 `vllnt/convex-gaming-music` — it
  does NOT get baked into `convex-music`.
- **Import lives in the component.** Because the catalog is the component's own tables, the
  import/sync/repair engine runs here (writing its own tables — allowed) — driven by mount policy.
  It **composes** `@convex-dev/workflow` / `workpool` for orchestration; it never re-implements them.
- **Factual vs editorial.** The component owns the *factual* catalog. Editorial precedence,
  overrides, `sourceRefs`, and the gameplay-frozen snapshot remain the host's.
- **Live vs synced popularity.** The component serves *live* popularity (cache-through); the host
  freezes a *synced* snapshot for deterministic gameplay grading.
- **Per-deployment data.** Sandboxed per mount — each app's catalog is its own data (shared schema +
  engine, isolated data). Not one shared catalog across apps.
- **V8 only.** A component runs in V8 → Apple ES256 JWT uses Web Crypto, not `jsonwebtoken`.
- **Official children.** Workflow / retry / rate-limit / response-cache compose `@convex-dev/*`,
  never hand-rolled.
- **Audio + image binaries are the host's.** The component stores metadata + URLs (and resolves an
  image policy); downloading/storing/licensing bytes is the host's concern.

---

## Non-goals (boundary — durable)

- **Not a gameplay/editorial store.** Puzzles, guesses, stats, editorial overrides, `sourceRefs`,
  frozen snapshots, and game taxonomy/attribution stay in the host, referencing catalog rows by
  id / ISRC. The component owns the factual catalog only.
- **Not an orchestrator.** Generic retry / backoff / batch orchestration is `@convex-dev/workflow` /
  `workpool`; the import engine composes them and never re-implements them.
- **Not a shared cross-app database.** Component tables are per-mount — each deployment has its own
  catalog data; the reuse is of schema + engine, not data.

## cache-core — `done`

The raw provider-fetch cache substrate: TTL'd entries, keyed lookups, ISRC cross-ref, prune.

- `cache-core.1` `done` — `cacheEntries` schema (`by_lookup`, `by_isrc`, `by_expiry`) + typed `*Value` validators.
- `cache-core.2` `done` — mutations: `put` (upsert + TTL), `invalidate`, `pruneExpired`.
- `cache-core.3` `done` — queries: `get` (read-time expiry), `getByIsrc`, `stats`.
- `cache-core.4` `done` — `Music` client class + `example/` harness, 100% coverage gate green.

## catalog-store — `planned`

The durable music database — generic, modeled on songtrivia's `music_*` shape.

- `catalog-store.1` `planned` — `artists` / `tracks` / `playlists` catalog tables (durable), ISRC-keyed track identity, artist↔track + playlist↔track relations, raw provider genres/popularity (no game taxonomy).
- `catalog-store.2` `planned` — read/search API over the catalog (`getArtist`/`getTrack`/`getPlaylist`, `searchArtists`/`searchTracks`, `getTrackByIsrc`) + reactive queries for hosts.
- `catalog-store.3` `planned` — cache↔catalog table design: decide whether `cacheEntries` persists as a short-lived raw-response dedup layer behind the catalog, or freshness folds into catalog rows via sync-status (songtrivia's single-table model). Document the chosen seam.
- `catalog-store.4` `planned` — upsert/merge into the catalog from normalized provider facts (dedup by ISRC/provider id; multi-provider `providers[]` junction).

## provider-adapters — `planned`

One normalize adapter per provider, behind a single interface. No host coupling.

- `provider-adapters.1` `planned` — adapter interface + normalized mappers (track/artist/album).
- `provider-adapters.2` `planned` — Spotify adapter (client-credentials OAuth; token cached via `@convex-dev/action-cache`).
- `provider-adapters.3` `planned` — Apple Music adapter (ES256 developer JWT via **Web Crypto**, zero-dep — port from `jsonwebtoken`).
- `provider-adapters.4` `planned` — MusicBrainz adapter (nationality/country, gender, `members` solo/group, debut/begin-date).
- `provider-adapters.5` `planned` — Wikidata adapter (overlap + gap-fill for artist facts).
- `provider-adapters.6` `planned` — Deezer adapter.

## read-through-fetch — `planned`

Fetch-on-miss verbs that fill the cache + catalog and return normalized facts. Compose official children.

- `read-through-fetch.1` `planned` — `search({ provider?, query, types })` (track + artist).
- `read-through-fetch.2` `planned` — `getTrack` / `getArtist` / `getAlbum` (cache-through → catalog).
- `read-through-fetch.3` `planned` — `resolveByIsrc` cross-provider track resolution.
- `read-through-fetch.4` `planned` — wire `@convex-dev/action-retrier` (backoff) + `@convex-dev/rate-limiter` (429) + `@convex-dev/workpool` (batch concurrency).
- `read-through-fetch.5` `planned` — live vs cached popularity option (`live: true` bypass / short TTL).
- `read-through-fetch.6` `planned` — mount-policy config: enabled providers + **preference order**, secret env-var names, market/locale, per-entity TTLs, rate limits, batch sizes, ISRC resolution strategy, prefetch budget, import filters-as-config (sensible zero-config defaults). The "managed by policy from init" surface.
- `read-through-fetch.7` `planned` — host wiring + credentials: the host mounts via `app.use(music)` in its `convex.config.ts`; provider credentials are supplied as **Convex environment variables** ([docs](https://docs.convex.dev/production/environment-variables)) on the deployment — Spotify (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`), Apple (`APPLE_MUSIC_ISSUER`, `APPLE_MUSIC_KID`, `APPLE_MUSIC_PRIVATE_KEY`), then Deezer/MusicBrainz/Wikidata — with env-var names overridable via the mount policy. Decide the consumption seam: component actions read `process.env` directly vs the host passes values at `app.use`. Document the required env vars per provider in the README.

## import-engine — `planned`

Policy-driven import of provider data into the component's catalog (writes its OWN tables).

- `import-engine.1` `planned` — `importPlaylist(url|id)` / `importArtist` / `importTrack(isrc)` entry points (host-triggered; provider auto-detect).
- `import-engine.2` `planned` — traversal: playlist → tracks → artists; promote normalized provider facts into the catalog tables (dedup by ISRC/provider id).
- `import-engine.3` `planned` — orchestration via `@convex-dev/workflow` + `workpool` (batch concurrency, step retries); config-driven import filters (title/quality), never game-specific rules.
- `import-engine.4` `planned` — import request ledger (status, phases, events) for ops visibility — component-owned, mirrors songtrivia's `music_imports` control plane.

## sync-lifecycle — `planned`

Keep the catalog fresh; recover failures. Operates on the component's own catalog rows.

- `sync-lifecycle.1` `planned` — sync-status state machine on catalog rows (`pending→running→synced/failed→stale`), validated transitions.
- `sync-lifecycle.2` `planned` — retry with backoff (entity-level, hours-scale) distinct from provider-call retry (seconds, via action-retrier).
- `sync-lifecycle.3` `planned` — budgeted, cursored batch-repair (find unsynced/failed/stale → re-sync), idempotent + per-mount.
- `sync-lifecycle.4` `planned` — maintenance crons (find-unsynced, retry-failed) — mount-safe, idempotent.

## artist-image-auto-sync — `planned`

Configurable artist profile-image resolution across providers + scheduled refresh. (Owner request.)

- `artist-image-auto-sync.1` `planned` — store per-provider artist image URLs alongside the artist row.
- `artist-image-auto-sync.2` `planned` — **provider-selection policy**: ordered preference (e.g. `["spotify","apple","wikidata"]`) + `strategy` (`first-available` | `highest-resolution`) + optional `fallback`. Configurable at mount and overridable per call. Resolves a single `profileImageUrl`.
- `artist-image-auto-sync.3` `planned` — `getArtistImage(key, { policyOverride? })` returns the policy-resolved URL.
- `artist-image-auto-sync.4` `planned` — auto-sync cron: idempotent, per-mount, re-fetches images on a configurable cadence and re-applies the policy (URLs only; binary storage stays host-side).
- `artist-image-auto-sync.5` `planned` — front-tooling analysis: a reactive `useArtistImage` hook only if a consumer renders catalog images.

## prune-cron — `planned`

- `prune-cron.1` `planned` — in-component idempotent cron calling `pruneExpired` on the raw cache (mount-safe, per-instance).

## consumer-migration — `planned`

Land each real consumer on the component; songtrivia is the reference.

- `consumer-migration.1` `planned` — migrate songtrivia onto the component: its `music/providers/*`, import engine, sync-status lifecycle, and `lib/music_sync` repair move INTO the component (catalog-owned); songtrivia keeps gameplay + editorial overrides + game categories/attribution, reading the catalog via the component API by id/ISRC.
- `consumer-migration.2` `planned` — spotzic reads artist facts from the catalog; host owns editorial merge + frozen snapshot.
- `consumer-migration.3` `planned` — heardzic ops track import + `getTrack` (audio source/licensing host-side).
- `consumer-migration.4` `planned` — bandzic ops track import + clip handling (host-side audio).

## release — `planned`

- `release.1` `planned` — make repo public when audit-clean + CI-green (currently private).
- `release.2` `planned` — add the README Components index row in the hub.
- `release.3` `planned` — first stable release (lift the canary-only `0.1.0` hold) once a consumer is live.
