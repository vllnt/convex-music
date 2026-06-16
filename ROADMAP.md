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
- **Three layers — provider-granular underneath, identity-unified on top (not a catalog per provider).**
  (1) **Raw cache** (`cacheEntries`) — ephemeral, TTL'd, **per-provider rows** keyed `(catalog, kind,
  provider, externalId)` = the verbatim provider response. (2) **Catalog** — durable; **one unified
  canonical entity per real-world identity** (track by ISRC, artist by resolved id, album by id) with a
  per-provider **`providers[]` provenance** — NOT one row per provider, and NOT a view. (3) **View** —
  the field-source policy / profiles project per-field across an entity's `providers[]`. A catalog
  **per provider is wrong**: the field-source policy ("preview from Apple, image from Spotify, 3 of 4")
  needs one entity holding all providers to project across — per-provider data lives in the provenance,
  not in separate catalogs. Identity resolution (ISRC / MBID+name / id) is the merge step
  (`catalog-store.4`). Matches all four games (songtrivia ISRC tracks + `providers[]`; spotzic
  artist facts aggregated across Spotify+MusicBrainz+Wikidata; heardzic/bandzic track previews).
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
  Seed/source entries are given by natural identifier — artist **name**, playlist **link/url**,
  track **ISRC**, or provider id (the `targetMode` set: `name`|`url`|`isrc`|`providerId`). A small
  `initialSources` seed in `app.use` is supported (zero-config/static bootstrap), but a real, evolving
  catalog is best filled via the **runtime `sources` registry + import primitives** — don't put a
  large/evolving list in the mount. "Fill" is a **declaration**: import is async + external, so the
  engine *reconciles toward* the declared sources (`listSources` + sync-status report what's actually
  populated) — there is no synchronous "filled at mount" guarantee.
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
- **Multiple searches per host.** A search targets a **catalog** (the partition — see *Multiple
  catalogs per mount*); each catalog carries its own kinds/providers/field-source policy, so an
  "artists search" and a "tracks search" are just two catalogs in one mount. Within a catalog, define
  **named profiles** (search presets) and/or pass a per-call field-source policy. **Named mounts**
  (`app.use(music, { name })` × N) remain available for hard cross-deployment isolation (the BLOCKING
  mount-safety requirement holds either way).
- **Multiple catalogs per mount (opaque `catalog` dimension) — owner decision.** One
  `app.use(music, { catalogs: { … } })` holds N catalogs, each with its own config (kinds, providers,
  field-source policy, profiles, retention), plus runtime `createCatalog` / `listCatalogs` so a
  catalog can be added without a redeploy. Implemented as an opaque `catalog` ref on every table +
  **scoped indexes + scoped reads**; a **default catalog** keeps single-catalog usage zero-config.
  **BLOCKING:** a non-scoped read must NEVER silently span catalogs (the mandate's footgun) — every
  catalog read carries the `catalog` id (or explicitly opts into cross-catalog). This favors host DX
  (one mount, one ref) over the fleet's default multi-mount lean — a deliberate deviation; native
  multi-mount still works for hard cross-deployment isolation. Different-domain catalogs (e.g.
  podcasts) remain out of scope — this is a music catalog. (Supersedes the earlier "named mounts
  only" decision.)
- **Pluggable providers — one adapter, one internal schema.** Adding a provider is a localized change:
  a new adapter (`client` auth/fetch · `types` the provider's RAW response schema, private · `mappers`
  raw→internal · `impl` the `MusicProvider` interface) registered in the registry — **no core edits**
  (open/closed). There is ONE internal **normalized schema** as the public contract; per-provider raw
  schemas stay private in adapters; the normalized row keeps per-provider **provenance** (`providers[]`)
  so the field-source policy projects per provider. We do NOT expose N public schemas — normalized +
  provenance covers it.
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

- `catalog-store.1` `planned` — durable `artists` / `tracks` / `playlists` tables as **one unified canonical entity per real-world identity** (track by **ISRC**, artist by **resolved id — MBID preferred, name fallback**, album by id/(artist+title+year)) — NOT one row per provider. Each entity carries a per-provider **`providers[]` provenance** (each provider's id + its field values), enabling the field-source policy. Artist↔track + playlist↔track relations; raw provider genres/popularity (no game taxonomy).
- `catalog-store.2` `planned` — read/search API over the catalog (`getArtist`/`getTrack`/`getPlaylist`, `searchArtists`/`searchTracks`, `getTrackByIsrc`) + reactive queries for hosts; every read/search accepts a per-call **field-source policy** override (kinds, fields, per-field provider source — see `field-source-policy`).
- `catalog-store.3` `planned` — cache↔catalog table design: decide whether `cacheEntries` persists as a short-lived raw-response dedup layer behind the catalog, or freshness folds into catalog rows via sync-status (songtrivia's single-table model). Document the chosen seam.
- `catalog-store.4` `planned` — **identity resolution + merge**: unify a provider's normalized facts into the canonical entity — tracks by ISRC (with a fallback when a provider omits ISRC), artists by MBID then name (configurable strategy), albums by id/(artist+title+year) — upserting that provider's slice into the entity's `providers[]` (idempotent; no duplicate canonical rows). This is the layer-1-raw → layer-2-unified promotion.
- `catalog-store.5` `planned` — `selectEligible({ kind, filter, weight?, excludeIds?, limit })` — generic random/weighted/filtered selection over the catalog (host passes `excludeIds` of recently-used subjects). The selection *primitive* for daily-game pickers; the daily-puzzle assignment (freeze, no-repeat, schedule) stays in the host/daily-game layer.
- `catalog-store.6` `planned` — **multi-catalog scope**: an opaque `catalog` ref on every table (cache, catalog, sources, sync rows) + **scoped indexes** (`by_catalog_*`) + a `catalogs` config table (mount-seeded `catalogs: {…}` AND runtime `createCatalog`/`listCatalogs`), each catalog holding its own kinds/providers/field-source policy/retention. **Default catalog** so single-catalog usage is zero-config. BLOCKING: every catalog read carries the `catalog` id — a non-scoped read must never silently span catalogs. Crons iterate catalogs (per-catalog prune/sync), idempotent. Client: `music.catalog("artists").search(…)` / per-call `catalog`.

## provider-adapters — `planned`

One normalize adapter per provider, behind a single interface. No host coupling.

- `provider-adapters.1` `planned` — the `MusicProvider` adapter **interface** (search/getTrack/getArtist/getAlbum/…) + the internal **normalized schema** (track/artist/album) as the single public contract. Each adapter is a folder: `client` (auth/fetch) · `types` (the provider's RAW response schema, private) · `mappers` (raw→normalized) · `impl` (implements the interface).
- `provider-adapters.2` `planned` — Spotify adapter (client-credentials OAuth; token cached via `@convex-dev/action-cache`).
- `provider-adapters.3` `planned` — Apple Music adapter (ES256 developer JWT via **Web Crypto**, zero-dep — port from `jsonwebtoken`).
- `provider-adapters.4` `planned` — MusicBrainz adapter (nationality/country, gender, `members` solo/group, debut/begin-date).
- `provider-adapters.5` `planned` — Wikidata adapter (overlap + gap-fill for artist facts).
- `provider-adapters.6` `planned` — Deezer adapter.
- `provider-adapters.7` `planned` — **extension point**: a `registry` that maps provider id → adapter; adding a provider = drop in its adapter folder + one registry entry, no core changes (open/closed). Document the "add a provider" steps in `docs/API.md`. Provider ids are an open union so a new provider just extends it.

## read-through-fetch — `planned`

Fetch-on-miss verbs that fill the cache + catalog and return normalized facts. Compose official children.

- `read-through-fetch.1` `planned` — `search({ provider?, query, types, policy? })` (track + artist); accepts a per-call **field-source policy** override (see `field-source-policy`).
- `read-through-fetch.2` `planned` — `getTrack` / `getArtist` / `getAlbum` (cache-through → catalog).
- `read-through-fetch.3` `planned` — `resolveByIsrc` cross-provider track resolution. Powers "playlist from provider A, track data from provider B": e.g. import an **Apple Music** playlist (Apple gives membership/order + per-track ISRC) and return each track's data from **Spotify** (resolve each ISRC → unified track → project track fields `from: "spotify"`). The playlist entity stays the source provider's; track members are resolved cross-provider by ISRC.
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
- `field-source-policy.6` `planned` — **named search profiles**: define presets `{ kinds, providers, sources }` at mount (`profiles: { artists: …, tracks: … }`) and invoke by name (`search({ profile: "artists", query })`) or a per-profile client accessor — multiple search types over one catalog without repeating the policy. (For hard isolation across instances, use named mounts instead — see Design decisions › Multiple searches per host.)
- `field-source-policy.7` `planned` — **cross-provider miss handling**: when a field's chosen provider lacks the entity (e.g. an Apple-playlist track whose ISRC isn't on Spotify), degrade gracefully — `{ from: "x" }` omits/nulls that field, `{ prefer: [...] }` falls back to the next provider, `{ from: "all" }` returns only the providers present. So "tracks from Spotify" resolves Spotify where the ISRC matches and falls back otherwise; never errors on a per-entity miss.

## import-engine — `planned`

Policy-driven import of provider data into the component's catalog (writes its OWN tables).

- `import-engine.1` `planned` — import entry points by natural identifier (the `targetMode` set `name`|`url`|`isrc`|`providerId`): `importArtist({ by:"name"|"providerId" })`, `importPlaylist({ url })`, `importTrack({ isrc })` (host-triggered; provider auto-detect from a url/id).
- `import-engine.2` `planned` — traversal: playlist → tracks → artists; promote normalized provider facts into the catalog tables (dedup by ISRC/provider id).
- `import-engine.3` `planned` — orchestration via `@convex-dev/workflow` + `workpool` (batch concurrency, step retries); config-driven import filters (title/quality), never game-specific rules.
- `import-engine.4` `planned` — import request ledger (status, phases, events) for ops visibility — component-owned, mirrors songtrivia's `music_imports` control plane.
- `import-engine.5` `planned` — generic **`sources` registry**: runtime host-managed CRUD (`addSource`/`removeSource`/`listSources`) of `{ kind, by: "name"|"url"|"isrc"|"providerId", value, providers?, cadence? }` the engine keeps synced; typed (no `v.any()`). Optional `initialSources` mount seed (small/static, zero-config bootstrap). This is the generic "what to keep imported" input — the host's *curated, categorized* definitions (which playlists/artists, genre rules, game categories) stay host-side and reconcile INTO this registry (e.g. a host cron over its own `PLAYLIST_DEFINITIONS`-style lists, like songtrivia).
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
