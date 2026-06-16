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
| songtrivia | full catalog + import; search **over the catalog**; getTrack/Artist/Album/Playlist; ISRC | live, reference consumer |
| spotzic | artist catalog + artist search; daily **artist** selection | catalog (artists) + editorial host-side |
| heardzic | track search (also via artist→tracks) + `previewUrl`; daily **track** selection | catalog (tracks) |
| bandzic | track search + `previewUrl`/clip; daily **track** selection | catalog (tracks) |

`harmonies` and `wordzic` are NOT consumers (word games — no catalog data).

Search is **over the durable catalog** (not just provider search) and the catalog has ≥3 consumers,
so search and catalog are one component — they are NOT split into `convex-music-search` /
`convex-music-catalog` (that would sever search from the catalog it queries, for no consumer gain).

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
- **Catalog content is runtime + host-owned, NOT mount-config.** Mount config governs HOW (providers,
  TTLs, filters, schedule, image policy), never WHAT. The host selects content at runtime via the
  import primitives + a generic `sources` registry (`import-engine.5`). The host's *curated,
  categorized* definitions — which playlists/artists, genre-enforcement rules, game categories /
  attribution — stay host-side (domain) and reconcile into the registry (e.g. a host cron over its
  own definition lists, exactly as songtrivia's crons drive `PLAYLIST_DEFINITIONS`/`ArtistDefinition`).
  The component owns the *generic* "keep these synced" input, never the curated/categorized list.
- **One component, no search/catalog split.** Search is *over the durable catalog*, and the catalog
  has ≥3 consumers (songtrivia full, spotzic artists, heardzic/bandzic tracks). Splitting search into
  a sibling `convex-music-search` would sever it from the catalog it queries with no consumer benefit
  (no one wants provider-search without the catalog). Catalog + search + cache + import stay one
  component. (A standalone search component is only revisited if a real provider-search-without-catalog
  consumer ever appears — composition keeps that a clean later extraction.)
- **Daily selection: primitive here, assignment in the gaming layer.** `convex-music` offers a generic
  `selectEligible(kind, filter, weight, excludeIds)` query over its catalog (it owns the data). The
  **daily-puzzle assignment** — today's frozen answer, no-repeat-within-N, scheduling — is the shared
  daily-game engine's job (gameplay), which calls `selectEligible` and freezes the result host-side.
  `excludeIds` (recently-used subjects) is gameplay data the host passes in; the component never tracks it.
- **Factual vs editorial.** The component owns the *factual* catalog. Editorial precedence,
  overrides, `sourceRefs`, and the gameplay-frozen snapshot remain the host's.
- **Live vs synced popularity.** The component serves *live* popularity (cache-through); the host
  freezes a *synced* snapshot for deterministic gameplay grading.
- **Field-source projection policy (every field, any subset, N-proof).** Consumers configure *what
  comes back*: which entity **kinds**, which **fields**, and — for **every field independently** —
  which provider(s) supply it: one (`from`), ordered-pick-one (`prefer`), an **explicit subset**
  (e.g. 3 of 4 `previewUrl`s), or **all** (optionally capped). Multi-select returns a provider-keyed
  **partial map** (`Partial<Record<Provider, V>>`) — so adding a 4th/5th provider only adds keys and
  never changes a field's type (the future-proofing principle). Single/`prefer` returns a scalar.
  **Default at mount**, **override per call**; zero-config default = mount preference order, all
  fields. One resolver over BOTH provider search and catalog reads, projecting from per-provider
  provenance (`providers[]`); fully typed/generic — never `v.any()`. The artist-image policy is this
  applied to `image`.
- **Per-deployment data.** Sandboxed per mount — each app's catalog is its own data (shared schema +
  engine, isolated data). Not one shared catalog across apps.
- **V8 only.** A component runs in V8 → Apple ES256 JWT uses Web Crypto, not `jsonwebtoken`.
- **Official children.** Workflow / retry / rate-limit / response-cache compose `@convex-dev/*`,
  never hand-rolled.
- **Resilient against provider overload (429 + 5xx/529).** songtrivia handles only `429`; the
  component must also retry overload `5xx` (incl. `529`, `503`) with `Retry-After` + capped backoff +
  jitter + per-request timeout + bounded concurrency, so a Spotify/Apple `529` never hard-fails an
  import. (See `read-through-fetch.4`.)
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
- **Not the daily-game.** `convex-music` provides a `selectEligible` primitive over the catalog; the
  daily-puzzle assignment (frozen answer, no-repeat-within-N, scheduling, gameplay) is the shared
  daily-game engine's job (host / a gaming-vertical layer), which calls into `convex-music`.
- **Not split into search vs catalog.** Search is over the catalog; they are one component (see
  Design decisions).

## cache-core — `done`

The raw provider-fetch cache substrate: TTL'd entries, keyed lookups, ISRC cross-ref, prune.

- `cache-core.1` `done` — `cacheEntries` schema (`by_lookup`, `by_isrc`, `by_expiry`) + typed `*Value` validators.
- `cache-core.2` `done` — mutations: `put` (upsert + TTL), `invalidate`, `pruneExpired`.
- `cache-core.3` `done` — queries: `get` (read-time expiry), `getByIsrc`, `stats`.
- `cache-core.4` `done` — `Music` client class + `example/` harness, 100% coverage gate green.

## catalog-store — `planned`

The durable music database — generic, modeled on songtrivia's `music_*` shape.

- `catalog-store.1` `planned` — `artists` / `tracks` / `playlists` catalog tables (durable), ISRC-keyed track identity, artist↔track + playlist↔track relations, raw provider genres/popularity (no game taxonomy).
- `catalog-store.2` `planned` — read/search API over the catalog (`getArtist`/`getTrack`/`getPlaylist`, `searchArtists`/`searchTracks`, `getTrackByIsrc`) + reactive queries for hosts; every read/search accepts a per-call **field-source policy** override (kinds, fields, per-field provider source — see `field-source-policy`).
- `catalog-store.3` `planned` — cache↔catalog table design: decide whether `cacheEntries` persists as a short-lived raw-response dedup layer behind the catalog, or freshness folds into catalog rows via sync-status (songtrivia's single-table model). Document the chosen seam.
- `catalog-store.4` `planned` — upsert/merge into the catalog from normalized provider facts (dedup by ISRC/provider id; multi-provider `providers[]` junction).
- `catalog-store.5` `planned` — `selectEligible({ kind, filter, weight?, excludeIds?, limit })` — generic random/weighted/filtered selection over the catalog (host passes `excludeIds` of recently-used subjects). The selection *primitive* for daily-game pickers; the daily-puzzle assignment (freeze, no-repeat, schedule) stays in the host/daily-game layer.

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

- `read-through-fetch.1` `planned` — `search({ provider?, query, types, policy? })` (track + artist); accepts a per-call **field-source policy** override (see `field-source-policy`).
- `read-through-fetch.2` `planned` — `getTrack` / `getArtist` / `getAlbum` (cache-through → catalog).
- `read-through-fetch.3` `planned` — `resolveByIsrc` cross-provider track resolution.
- `read-through-fetch.4` `planned` — **resilient provider calls**: retry on `429` **AND overload `5xx` (500/502/503/504/`529`)** — songtrivia retries ONLY 429, so overload `529`/`503` currently throw un-retried (the gap to fix). Honor `Retry-After`, capped exponential backoff + jitter (cap ~60s, bounded attempts), per-request timeout, bounded concurrency. Compose `@convex-dev/action-retrier` + `@convex-dev/rate-limiter` + `@convex-dev/workpool`; optional circuit-breaker per provider.
- `read-through-fetch.5` `planned` — live vs cached popularity option (`live: true` bypass / short TTL).
- `read-through-fetch.6` `planned` — mount-policy config: enabled providers + **preference order**, secret env-var names, market/locale, per-entity TTLs, rate limits, batch sizes, ISRC resolution strategy, prefetch budget, import filters-as-config (sensible zero-config defaults). The "managed by policy from init" surface.
- `read-through-fetch.7` `planned` — host wiring + credentials: the host mounts via `app.use(music)` in its `convex.config.ts`; provider credentials are supplied as **Convex environment variables** ([docs](https://docs.convex.dev/production/environment-variables)) on the deployment — Spotify (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`), Apple (`APPLE_MUSIC_ISSUER`, `APPLE_MUSIC_KID`, `APPLE_MUSIC_PRIVATE_KEY`), then Deezer/MusicBrainz/Wikidata — with env-var names overridable via the mount policy. Decide the consumption seam: component actions read `process.env` directly vs the host passes values at `app.use`. Document the required env vars per provider in the README. Provider enable/preference (the mount policy's `providers` list) supersedes songtrivia's `SPOTIFY_ONLY` / `APPLE_ONLY` env toggles — those become config, not env flags.

## field-source-policy — `planned`

Configure *what comes back* from search + catalog reads: entity kinds, field projection, and per-field
provider source. One resolver over the per-provider `providers[]` provenance. Generalizes the
artist-image policy to every field.

- `field-source-policy.1` `planned` — policy shape: `kinds` (which of artist/track/album to return), `fields` (include/exclude projection), and `sources` — a `Partial<Record<Field, SourceSpec>>` over **every** field (image, previewUrl, popularity, genres, coverUrl, url, country, gender, …), each field independently configurable. `SourceSpec`: `{ from: "<provider>" }` single → scalar · `{ prefer: ["p1","p2",…] }` ordered first-available → scalar · `{ from: ["p1","p2","p3"] }` **explicit subset** (e.g. 3 of 4) → provider-keyed map · `{ from: "all", limit? }` every available (optionally capped by preference) → provider-keyed map. Unspecified fields fall back to the mount default.
- `field-source-policy.2` `planned` — **default at mount**, **per-call override** (deep-merge, per-call wins); zero-config default = mount preference order, all fields.
- `field-source-policy.3` `planned` — one resolver applied to BOTH provider search (`read-through-fetch`) and catalog search/get (`catalog-store`). Worked cases: artists-only + `image` from Spotify; tracks + `previewUrl` from Apple (not Spotify); both.
- `field-source-policy.4` `planned` — depends on per-provider field provenance retained in the catalog (`providers[]`, `catalog-store.4`); the resolver projects each field from the chosen provider(s).
- `field-source-policy.5` `planned` — **N-proof typed returns**: single/`prefer` → a resolved scalar; subset/`all` → a `Partial<Record<Provider, V>>` map for that field (only present providers are keys). Adding a 4th/5th provider only adds keys — the field's type never changes. No `v.any()`; the client type is generic over the policy.

## import-engine — `planned`

Policy-driven import of provider data into the component's catalog (writes its OWN tables).

- `import-engine.1` `planned` — `importPlaylist(url|id)` / `importArtist` / `importTrack(isrc)` entry points (host-triggered; provider auto-detect).
- `import-engine.2` `planned` — traversal: playlist → tracks → artists; promote normalized provider facts into the catalog tables (dedup by ISRC/provider id).
- `import-engine.3` `planned` — orchestration via `@convex-dev/workflow` + `workpool` (batch concurrency, step retries); config-driven import filters (title/quality), never game-specific rules.
- `import-engine.4` `planned` — import request ledger (status, phases, events) for ops visibility — component-owned, mirrors songtrivia's `music_imports` control plane.
- `import-engine.5` `planned` — generic **`sources` registry**: runtime host-managed CRUD (`addSource`/`removeSource`/`listSources`) of `{ provider, kind, externalId|url, cadence }` the engine keeps synced. Optional `initialSources` mount seed for zero-config. This is the generic "what to keep imported" input — the host's *curated, categorized* definitions (which playlists/artists, genre rules, game categories) stay host-side and reconcile INTO this registry (e.g. a host cron over its own `PLAYLIST_DEFINITIONS`-style lists, like songtrivia).
- `import-engine.6` `planned` — **import-request dedup**: a stable dedup key over (entityType, targetMode, provider, ref) so concurrent/duplicate import requests collapse to one (mirrors songtrivia's `buildMusicImportDedupeKey`).

## sync-lifecycle — `planned`

Keep the catalog fresh; recover failures. Operates on the component's own catalog rows.

- `sync-lifecycle.1` `planned` — sync-status state machine on catalog rows (`pending→running→synced/failed→stale`), validated transitions.
- `sync-lifecycle.2` `planned` — retry with backoff (entity-level, hours-scale) distinct from provider-call retry (seconds, via action-retrier).
- `sync-lifecycle.3` `planned` — budgeted, cursored batch-repair (find unsynced/failed/stale → re-sync), idempotent + per-mount.
- `sync-lifecycle.4` `planned` — maintenance crons (find-unsynced, retry-failed) — mount-safe, idempotent.
- `sync-lifecycle.5` `planned` — concurrency-safe batch claims: acquire/release a lease (claim token + lease TTL) so parallel sync workers don't double-process; scavenge expired claims; ISRC chunking + dedup guardrails (mirrors `tracks/claims.ts` + `track_sync_guardrails.ts`).
- `sync-lifecycle.6` `planned` — repair-status state machine (`clean → needs_repair → repairing → failed_repair`, validated transitions) + atomic repair claim — the GENERIC repair infra. The specific *what* to repair (e.g. genre links, junctions) is host-domain; the component owns the state machine + claim + budgeted runner, not the domain repair rules.

## artist-image-auto-sync — `planned`

Configurable artist profile-image resolution across providers + scheduled refresh. (Owner request.)

- `artist-image-auto-sync.1` `planned` — store per-provider artist image URLs alongside the artist row.
- `artist-image-auto-sync.2` `planned` — **image provider-selection** = the `field-source-policy` applied to the `image` field: ordered preference (e.g. `["spotify","apple","wikidata"]`) + `strategy` (`first-available` | `highest-resolution`) + optional `fallback`, resolving a single `profileImageUrl`. Reuses the general resolver, not a separate mechanism.
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
