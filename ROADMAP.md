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
- **Three provider levels — don't conflate.** (1) **Catalog `providers`** (mount) = the universe a
  catalog aggregates. (2) **Import `providers`/`excludeProviders`** (per import) = the subset to FETCH
  for that import (⊆ catalog) — what gets stored. (3) **Field-source policy** (per read) = which
  provider(s) to PROJECT per field, over what's stored. "Which providers when importing" is level 2
  (fetch/store); "preview from Apple" is level 3 (project). See `import-engine.7` + `field-source-policy`.
- **V8 only.** A component runs in V8 → Apple ES256 JWT uses Web Crypto, not `jsonwebtoken`.
- **Composed components — official `@convex-dev/*` + our `@vllnt/*`, never hand-rolled (BLOCKING).**
  The engine COMPOSES, it does not re-implement. Committed mapping (mounted as child components in
  `src/component/convex.config.ts` via `component.use(...)` when each layer lands):
  - **`@convex-dev/action-cache`** — provider token cache: the cached Spotify client-credentials
    token (~55min TTL) and the signed Apple developer JWT (6-month TTL). Wired as the adapters'
    injected `getToken` (`read-through-fetch.6/7`, `provider-adapters.2/3`).
  - **`@convex-dev/workflow`** + **`@convex-dev/workpool`** — import traversal orchestration: durable
    multi-step playlist→tracks→artists fan-out, step retries, bounded batch concurrency
    (`import-engine.3`).
  - **`@convex-dev/rate-limiter`** — TWO distinct token buckets: the auto-import throughput budget
    ("2 artists/hour", per `(catalog, kind)` — `auto-import.2`) AND the provider-API rate guard
    (429/529 protection — `read-through-fetch.4`). Distinct layers, same primitive.
  - **`@vllnt/convex-idempotency`** (our own) — import-request dedup: backs the stable dedupe-key so a
    duplicate in-flight import collapses idempotently (`import-engine.6`). The 8-state control-plane
    table stays component-owned (the *active-only* dedup + `withTracks` distinction is state-machine
    semantics); idempotency provides the exactly-once execution seam underneath it.
  The only deliberate NON-composition: the per-HTTP-request resilient fetch (429/Retry-After/backoff)
  is inline, NOT `@convex-dev/action-retrier` — action-retrier retries whole *actions*, a different
  layer than per-request rate-limit handling (songtrivia is inline here too).
- **Resilient against provider overload (429 + 5xx/529).** songtrivia handles only `429`; the
  component must also retry overload `5xx` (incl. `529`, `503`) with `Retry-After` + capped backoff +
  jitter + per-request timeout + bounded concurrency, so a Spotify/Apple `529` never hard-fails an
  import. (See `read-through-fetch.4`.)
- **Automation is opt-in + budgeted; two rate layers.** Auto-import is **off by default** (a fresh
  mount never auto-hammers providers). When enabled, throughput is a configurable **budget** — e.g.
  "2 artists/hour" — enforced by a `@convex-dev/rate-limiter` token bucket per `(catalog, kind)`,
  **decoupled from cron frequency** (not "cron-hourly-do-1"). This entity-throughput budget is
  **distinct** from the provider-API rate (429/529 protection): one paces how many entities we import,
  the other protects the provider's HTTP API. (See `auto-import`.)
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

## catalog-store — `in-progress`

The durable music database — generic, modeled on songtrivia's `music_*` shape.

- `catalog-store.1` `done` — durable `artists` / `tracks` / `playlists` tables as **one unified canonical entity per real-world identity** (track by **ISRC**, artist by **resolved id — MBID preferred, name fallback**, album by id/(artist+title+year)) — NOT one row per provider. Each entity carries a per-provider **`providers[]` provenance** (each provider's id + its field values), enabling the field-source policy. Artist↔track + playlist↔track relations; raw provider genres/popularity (no game taxonomy). Plus a denormalized **provider-id reverse index** (a `*_providers` junction with `by_provider_providerId`) — Convex can't index inside arrays, so `resolveByIsrc` / `importArtist({ by:"providerId" })` would full-scan without it (songtrivia keeps exactly this, `junctions/schemas.ts`). Keep the **ISRC-mismatch guard** (a provider disagreeing on a unified track's ISRC throws — not silent last-write-wins, `tracks/track.ts:108`).
- `catalog-store.2` `in-progress` — read/search API over the catalog (`getArtist`/`getTrack`/`getPlaylist`, `searchArtists`/`searchTracks`, `getTrackByIsrc`) + reactive queries for hosts; every read/search accepts a per-call **field-source policy** override (kinds, fields, per-field provider source — see `field-source-policy`).
- `catalog-store.3` `done` — cache↔catalog table design: decide whether `cacheEntries` persists as a short-lived raw-response dedup layer behind the catalog, or freshness folds into catalog rows via sync-status (songtrivia's single-table model). Document the chosen seam.
- `catalog-store.4` `done` — **identity resolution + merge**: unify a provider's normalized facts into the canonical entity — tracks by ISRC (with a fallback when a provider omits ISRC), artists by MBID then name (configurable strategy), albums by id/(artist+title+year) — upserting that provider's slice into the entity's `providers[]` (idempotent; no duplicate canonical rows). This is the layer-1-raw → layer-2-unified promotion.
- `catalog-store.5` `done` — `selectEligible({ kind, filter, weight?, excludeIds?, limit })` — generic random/weighted/filtered selection over the catalog (host passes `excludeIds` of recently-used subjects). The selection *primitive* for daily-game pickers; the daily-puzzle assignment (freeze, no-repeat, schedule) stays in the host/daily-game layer. Offers a **deterministic daily-rotation** ordering mode (date-bucketed FNV hash, stable within a UTC day, rotates daily — songtrivia's `browse_order.ts`) for stable-but-rotating browse with no host state.
- `catalog-store.6` `planned` — **multi-catalog scope**: an opaque `catalog` ref on every table (cache, catalog, sources, sync rows) + **scoped indexes** (`by_catalog_*`) + a `catalogs` config table (mount-seeded `catalogs: {…}` AND runtime `createCatalog`/`listCatalogs`), each catalog holding its own kinds/providers/field-source policy/retention. **Default catalog** so single-catalog usage is zero-config. BLOCKING: every catalog read carries the `catalog` id — a non-scoped read must never silently span catalogs. Crons iterate catalogs (per-catalog prune/sync), idempotent. Client: `music.catalog("artists").search(…)` / per-call `catalog`. (Owner decision; **build deferred** — named mounts serve until a single deployment needs N runtime catalogs.)
- `catalog-store.7` `done` — **playlist membership diff**: store playlist membership with order + a provider snapshot/version; on re-import, detect **removals + reorders** — songtrivia is union-only (never removes dropped tracks, no order; `playlists/track_sync.ts`). Membership is a diff, not an append.

## provider-adapters — `done`

One normalize adapter per provider, behind a single interface. No host coupling.

- `provider-adapters.1` `done` — the `MusicProvider` adapter **interface** (search/getTrack/getArtist/getAlbum/getPlaylist/topTracks/artistAlbums/searchByIsrc/getSeveralTracks) + provider-tagged normalized entities over the client normalized schema as the single contract (`src/component/providers/types.ts`). Each adapter is a folder: `client` (auth/fetch) · `types` (RAW response schema, private) · `mappers` (raw→normalized) · `impl`.
- `provider-adapters.2` `done` — Spotify adapter (client-credentials OAuth token exchange; all 9 methods; bounded-concurrency artist albums; chunked `getSeveralTracks` ISRC enrichment). Token caching via `@convex-dev/action-cache` lands with the action layer (`read-through-fetch`).
- `provider-adapters.3` `done` — Apple Music adapter, **full V8 re-architecture**: ES256 developer-token signer on Web Crypto `subtle.sign` (ECDSA P-256, PKCS8 import + JWS assembly + base64url, zero-dep — `apple/jwt.ts`), replacing songtrivia's `jsonwebtoken`. All 9 methods; Apple inlines album/playlist tracks via `include=tracks`. 100% covered with a real local sign+verify round-trip.
- `provider-adapters.4` `done` — MusicBrainz adapter (nationality/country, gender, `members` solo/group, debut/begin-date).
- `provider-adapters.5` `done` — Wikidata adapter (overlap + gap-fill for artist facts).
- `provider-adapters.6` `done` — Deezer adapter.
- `provider-adapters.7` `in-progress` — **extension point**: a `registry` mapping provider id → adapter factory (`src/component/providers/registry.ts`); adding a provider = its folder + one registry entry, no core changes (open/closed). Provider ids are an open union. Remaining: document the "add a provider" steps in `docs/API.md`.

## read-through-fetch — `in-progress`

Fetch-on-miss verbs that fill the cache + catalog and return normalized facts. Compose official children.

- `read-through-fetch.1` `done` — `search({ provider?, query, types, policy? })` (track + artist); accepts a per-call **field-source policy** override (see `field-source-policy`).
- `read-through-fetch.2` `in-progress` — `getTrack` / `getArtist` / `getAlbum` (cache-through → catalog).
- `read-through-fetch.3` `done` — `resolveByIsrc` cross-provider track resolution. Powers "playlist from provider A, track data from provider B": e.g. import an **Apple Music** playlist (Apple gives membership/order + per-track ISRC) and return each track's data from **Spotify** (resolve each ISRC → unified track → project track fields `from: "spotify"`). The playlist entity stays the source provider's; track members are resolved cross-provider by ISRC.
- `read-through-fetch.4` `in-progress` — **resilient provider calls**: DONE — `src/component/providers/fetch.ts` retries `429` **AND overload `5xx` (500/502/503/504/529)** (songtrivia retried only 429), honoring `Retry-After`, capped exponential backoff + jitter (60s cap, bounded attempts), per-request timeout, and a bounded-concurrency map. Remaining: compose `@convex-dev/rate-limiter` for the provider-API rate budget + optional per-provider circuit-breaker at the action layer.
- `read-through-fetch.5` `planned` — live vs cached popularity option (`live: true` bypass / short TTL).
- `read-through-fetch.6` `planned` — mount-policy config: enabled providers + **preference order**, secret env-var names, market/locale, per-entity TTLs, rate limits, batch sizes, ISRC resolution strategy, prefetch budget, import filters-as-config (sensible zero-config defaults). The "managed by policy from init" surface.
- `read-through-fetch.7` `done` — host wiring + credentials. **Seam RESOLVED (verified live): a Convex component is sandboxed from the deployment's env vars — it CANNOT read `process.env`.** So NOT "component reads env"; instead the **host** reads its own deployment env vars (Spotify `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`; Apple `APPLE_MUSIC_ISSUER`/`APPLE_MUSIC_KID`/`APPLE_MUSIC_PRIVATE_KEY`) and calls `music.configure(ctx, provider, secrets)` once; the component stores them in its sandboxed `providerConfig` table and reads them only inside its token actions (token/JWT cached via `@convex-dev/action-cache`). Validated end-to-end on `vllnt:convex-music` dev against **real Spotify and real Apple Music** (the V8 ES256 JWT is accepted by Apple's API). Also discovered live: **host wrappers returning component docs must use a loose return validator** — a host cannot re-validate component row ids (`v.id("artists")`); the typed shape comes from the `Music` client return types. Provider enable/preference is the mount policy's `providers` list + the per-import select; no env-based gating.
- `read-through-fetch.8` `done` — **Spotify ISRC enrichment**: Spotify playlist/album track objects omit ISRC; re-fetch them via batch `GET /tracks` (chunks of 50) before catalog promotion, preserving original cover/preview (`spotify/impl.ts:75`). Without this, Spotify playlist/album imports yield ISRC-less tracks that can't be unified. Market-restricted Spotify tracks return `null` in batch responses → filter them out.

## field-source-policy — `in-progress`

Configure *what comes back* from search + catalog reads: entity kinds, field projection, and per-field
provider source. One resolver over the per-provider `providers[]` provenance. Generalizes the
artist-image policy to every field.

- `field-source-policy.1` `done` — policy shape: `kinds` (which of artist/track/album to return), `fields` (include/exclude projection), and `sources` — a `Partial<Record<Field, SourceSpec>>` over **every** field (image, previewUrl, popularity, genres, coverUrl, url, country, gender, …), each field independently configurable. `SourceSpec`: `{ from: "<provider>" }` single → scalar · `{ prefer: ["p1","p2",…] }` ordered first-available → scalar · `{ from: ["p1","p2","p3"] }` **explicit subset** (e.g. 3 of 4) → provider-keyed map · `{ from: "all", limit? }` every available (optionally capped by preference) → provider-keyed map. Unspecified fields fall back to the mount default. **Ship first:** `{from}` + `{prefer}` (scalar) — covers all four games; the subset / `{from:"all"}` **map mode is deferred** (design kept; no game consumes a provider-keyed map yet — owner-requested "3 of 4 previews", build when a consumer lands).
- `field-source-policy.2` `planned` — **default at mount**, **per-call override** (deep-merge, per-call wins); zero-config default = mount preference order, all fields.
- `field-source-policy.3` `planned` — one resolver applied to BOTH provider search (`read-through-fetch`) and catalog search/get (`catalog-store`). Worked cases: artists-only + `image` from Spotify; tracks + `previewUrl` from Apple (not Spotify); both.
- `field-source-policy.4` `planned` — depends on per-provider field provenance retained in the catalog (`providers[]`, `catalog-store.4`); the resolver projects each field from the chosen provider(s).
- `field-source-policy.5` `done` — **N-proof typed returns**: single/`prefer` → a resolved scalar; subset/`all` → a `Partial<Record<Provider, V>>` map for that field (only present providers are keys). Adding a 4th/5th provider only adds keys — the field's type never changes. No `v.any()`; the client type is generic over the policy. **(Map mode deferred — the scalar single/`prefer` path ships first.)**
- `field-source-policy.6` `planned` — **named search profiles**: define presets `{ kinds, providers, sources }` at mount (`profiles: { artists: …, tracks: … }`) and invoke by name (`search({ profile: "artists", query })`) or a per-profile client accessor — multiple search types over one catalog without repeating the policy. (For hard isolation across instances, use named mounts instead — see Design decisions › Multiple searches per host.)
- `field-source-policy.7` `done` — **cross-provider miss handling**: when a field's chosen provider lacks the entity (e.g. an Apple-playlist track whose ISRC isn't on Spotify), degrade gracefully — `{ from: "x" }` omits/nulls that field, `{ prefer: [...] }` falls back to the next provider, `{ from: "all" }` returns only the providers present. So "tracks from Spotify" resolves Spotify where the ISRC matches and falls back otherwise; never errors on a per-entity miss.

## import-engine — `in-progress`

Policy-driven import of provider data into the component's catalog (writes its OWN tables).

- `import-engine.1` `done` — import entry points by natural identifier (the `targetMode` set `name`|`url`|`isrc`|`providerId`|`entityId`): `importArtist({ by:"name"|"providerId" })`, `importPlaylist({ url })`, `importTrack({ isrc })`, and `reimport({ entityId })` (re-import/repair an already-resolved catalog row by id — songtrivia's 5th `targetMode`). Host-triggered; provider auto-detect from a url/id. Each accepts a per-call **`ImportOptions`** (see `import-engine.7`).
- `import-engine.2` `in-progress` — traversal: playlist → tracks → artists; promote normalized provider facts into the catalog tables (dedup by ISRC/provider id).
- `import-engine.3` `in-progress` — orchestration via `@convex-dev/workflow` + `workpool` (batch concurrency, step retries); config-driven import filters (title/quality — adopt songtrivia's generic word-boundary title heuristics, `filters/title.ts`), never game-specific rules. **Partial-failure tolerance**: traversal uses `Promise.allSettled` so one failed album/track fetch doesn't abort the import; surface an `isPartial` flag + truncation cap (songtrivia `MAX_ALBUMS_PER_ARTIST=30`, semaphore 5, `spotify/impl.ts:243`).
- `import-engine.4` `done` — import **control-plane state machine** (not just a ledger): request status `queued→claimed→running→{retry_waiting↺}→completed|failed|canceled|stale` with validated transitions + a phase/event ledger + a **manual-recovery surface** (`canRepair`/`canRetry`/`retryMode`) + provider-contribution & queue summaries — component-owned, modeling songtrivia's 8-state `music_imports` control plane (`imports/schemas.ts:51`). Per-request retry budget **2 × [15s, 60s]** → `stale`.
- `import-engine.5` `done` — generic **`sources` registry**: runtime host-managed CRUD (`addSource`/`removeSource`/`listSources`) of `{ kind, by: "name"|"url"|"isrc"|"providerId", value, providers?, cadence? }` the engine keeps synced; typed (no `v.any()`). Optional `initialSources` mount seed (small/static, zero-config bootstrap). This is the generic "what to keep imported" input — the host's *curated, categorized* definitions (which playlists/artists, genre rules, game categories) stay host-side and reconcile INTO this registry (e.g. a host cron over its own `PLAYLIST_DEFINITIONS`-style lists, like songtrivia).
- `import-engine.6` `done` — **import-request dedup**, backed by **`@vllnt/convex-idempotency`** (compose, don't hand-roll the dedup store): a stable pipe-joined key over (`entityType`, `mode`/requestType, `targetMode`, `providerScope`, `provider`, `providerId`, `entityId`, name→lowercased, isrc→UPPERCASED, `url`, `withTracks`) collapsing **only against ACTIVE requests** (`queued|claimed|running|retry_waiting`) — so a `refresh` doesn't dedup into an `import` and a `withTracks` import doesn't collapse into a shallow one (matches songtrivia `buildMusicImportDedupeKey`, `imports/actions.ts:48`, incl. case-normalization). The 8-state control-plane table (`import-engine.4`) stays component-owned for the active-only + `withTracks` semantics; `@vllnt/convex-idempotency` provides the exactly-once execution seam keyed by the dedupe key.
- `import-engine.7` `in-progress` — typed **`ImportOptions`** per call (no `v.any()`): **provider select** `providers?: Provider[]` (only these) OR `excludeProviders?: Provider[]` (default = catalog set) — what to FETCH this import; **traversal/depth** — artist `tracks?: false | { mode: "top"|"all"|"viaAlbums", limit?, importArtists?: bool }` + `albums?: false | { limit? }`, playlist `tracks?: { limit?, importArtists?: bool }`, track `withArtists?: bool` + `withAlbum?: bool`; **`mode`** `import|refresh|reimport|repair`; **`priority`** `high|normal|low`; **`catalog`** scope. Generalizes songtrivia's import request (provider scope `spotify|apple|any` → N-provider select; `withTracks` → traversal; `requestType`/`priority`). Conservative defaults (artist = artist only; playlist = its tracks, not their artists; track = just the track). Traversal `limit`s bound the workflow fan-out. **Ship first:** `withTracks`-equivalent + `mode` (songtrivia's proven surface); **defer** `viaAlbums` + album-limit traversal until a consumer needs it.
- `import-engine.8` `planned` — **default import options** layered: per-catalog `defaultImport` at mount + per-`sources`-entry options (so cron re-imports honor them) + per-call override (deep-merge, per-call wins).

## sync-lifecycle — `in-progress`

Keep the catalog fresh; recover failures. Operates on the component's own catalog rows.

- `sync-lifecycle.1` `in-progress` — sync-status state machine on catalog rows (`pending→running→synced/failed→stale`), validated transitions.
- `sync-lifecycle.2` `done` — retry with backoff (entity-level, hours-scale) distinct from provider-call retry (seconds, via action-retrier).
- `sync-lifecycle.3` `planned` — budgeted, cursored batch-repair (find unsynced/failed/stale → re-sync), idempotent + per-mount.
- `sync-lifecycle.4` `in-progress` — maintenance crons (find-unsynced, retry-failed) — mount-safe, idempotent.
- `sync-lifecycle.5` `planned` — concurrency-safe batch claims: acquire/release a lease (claim token + lease TTL) so parallel sync workers don't double-process; scavenge expired claims; ISRC chunking + dedup guardrails (mirrors `tracks/claims.ts` + `track_sync_guardrails.ts`).
- `sync-lifecycle.6` `planned` — repair-status state machine (`clean → needs_repair → repairing → failed_repair`, validated transitions) + atomic repair claim — the GENERIC repair infra. The specific *what* to repair (e.g. genre links, junctions) is host-domain; the component owns the state machine + claim + budgeted runner, not the domain repair rules. Adopt songtrivia's repair constants (`MAX_REPAIR_ATTEMPTS=3`, in-progress reset `15min`, error cap 256).
- `sync-lifecycle.7` `planned` — **recovery from abandonment**: (a) **stuck-pending/running watchdog** — rows whose workflow died (no update for `≈5min`) reset to `failed`; (b) **stale-salvage** — periodic capped recovery of `stale` rows (songtrivia: weekly, `7d` threshold, `MAX_SALVAGE_ATTEMPTS=3`) rather than leaving `stale` terminal.

## auto-import — `in-progress`

Scheduled, **budgeted** automation with two modes on one cron: **import** (pull NEW entities from the
`sources` registry) and **sync/refresh** (keep EXISTING catalog rows current per a freshness config).
**Opt-in** (off by default — a fresh mount never auto-hammers providers). `sync-lifecycle` is the
mechanism (sync-status state machine); this phase is the schedule + budgets + freshness policy that
drives it.

- `auto-import.1` `in-progress` — per-catalog `autoImport` config: `enabled` (default false), `schedule` (`{ cron }` | `{ everyMs }`), `select` (`unsynced-first` | `stale-oldest` | `priority`), `maxConcurrent` (workpool bound). Typed, zero-config default = disabled.
- `auto-import.2` `done` — **throughput budget** decoupled from cron: a `@convex-dev/rate-limiter` token bucket per `(catalog, kind)` — `rate: { artist: { count: 2, per: "1h" }, track: { count: 20, per: "1h" } }` ("2 artists/hour"). The bucket is the authoritative cap regardless of cron frequency, survives restarts. **Distinct from the provider-API rate** (`read-through-fetch.4`, 429/529): this paces *entity throughput*, that protects the *provider HTTP API*.
- `auto-import.3` `in-progress` — the sweep cron: per-mount, idempotent, **cursored** (resume across runs, reuse songtrivia's `runBudgetedBatchedJob` pattern) — picks unsynced sources + stale catalog rows within the rate budget, enqueues imports via workpool honoring each source's `ImportOptions`. Backpressure: budget exhausted → no-op until the window refills (no unbounded queue).
- `auto-import.4` `done` — separate budgets/priority for **new import vs refresh** (optional): new-source imports take priority over stale-row refreshes; oldest-first within each.
- `auto-import.5` `in-progress` — **freshness / refresh config** (the "keep data up to date" policy): per-catalog (per-kind, optionally per-field) staleness window — `refresh: { artist: { staleAfter: "7d" }, track: { staleAfter: "30d" }, fields?: { popularity: { staleAfter: "1d" } }, rate?: {…} }` — drives the sync-status `synced → stale` transition; the sweep re-syncs past-window entities within a **refresh budget** distinct from the new-import budget (`auto-import.2`). Per-field windows honor live-vs-synced popularity (volatile fields refresh faster than static facts like genres/debut/ISRC).

## artist-image-auto-sync — `in-progress`

Configurable artist profile-image resolution across providers + scheduled refresh. (Owner request.)

- `artist-image-auto-sync.1` `done` — store per-provider artist image URLs alongside the artist row.
- `artist-image-auto-sync.2` `done` — **image provider-selection** = the `field-source-policy` applied to the `image` field: ordered preference (e.g. `["spotify","apple","wikidata"]`) + `strategy` (`first-available` | `highest-resolution`) + optional `fallback`, resolving a single `profileImageUrl`. Reuses the general resolver, not a separate mechanism.
- `artist-image-auto-sync.3` `done` — `getArtistImage(key, { policyOverride? })` returns the policy-resolved URL.
- `artist-image-auto-sync.4` `planned` — auto-sync cron: idempotent, per-mount, re-fetches images on a configurable cadence and re-applies the policy (URLs only; binary storage stays host-side).
- `artist-image-auto-sync.5` `done` — front-tooling analysis: a reactive `useArtistImage` hook only if a consumer renders catalog images.

## prune-cron — `done`

- `prune-cron.1` `done` — in-component idempotent cron calling `pruneExpired` on the raw cache (mount-safe, per-instance).

## consumer-migration — `planned`

Land each real consumer on the component; songtrivia is the reference.

- `consumer-migration.1` `planned` — migrate songtrivia onto the component: its `music/providers/*`, import engine, sync-status lifecycle, and `lib/music_sync` repair move INTO the component (catalog-owned); songtrivia keeps gameplay + editorial overrides + game categories/attribution, reading the catalog via the component API by id/ISRC.
- `consumer-migration.2` `planned` — spotzic reads artist facts from the catalog; host owns editorial merge + frozen snapshot.
- `consumer-migration.3` `planned` — heardzic ops track import + `getTrack` (audio source/licensing host-side).
- `consumer-migration.4` `planned` — bandzic ops track import + clip handling (host-side audio).

## reference-defaults — `planned`

Concrete constants to **adopt from songtrivia as config defaults** (don't re-derive; all configurable).

| Concern | Default (songtrivia) |
| --- | --- |
| Provider call | timeout 15s (token 5s) · retry 6 attempts · 60s cap · 250ms jitter · `Retry-After` fallback 5s |
| Spotify token | `action-cache` 55-min TTL · inner 3 tries (250ms/500ms/1s) |
| Apple JWT | 6-month `exp`, cached |
| Entity sync retry | `[1h, 6h, 24h]` × 3 → `stale` · error cap 500 |
| Repair | 3 attempts · in-progress reset 15min · error cap 256 |
| Claim lease | 60min · scavenge-first cap 100 · token-verified release |
| ISRC chunking | 200/exec · 50 starts/batch · Set-dedup-then-sort |
| Import request retry | 2 × `[15s, 60s]` → `stale` |
| Budgeted job | batch 50 × 5 batches/run · cursor-resume · stop-reason complete\|budget |
| Staleness by popularity | HIGH(≥70)=7d · MED(≥40)=30d · LOW=90d |
| Provider limits | Spotify batch `/tracks` 50 · album page 50 · search 10 · ISRC search 5 · `MAX_ALBUMS_PER_ARTIST` 30 · concurrency 5 |
| Market | `US`/`us` → **must become locale config**, not hardcoded |

## release — `planned`

- `release.1` `planned` — make repo public when audit-clean + CI-green (currently private).
- `release.2` `planned` — add the README Components index row in the hub.
- `release.3` `planned` — first stable release (lift the canary-only `0.1.0` hold) once a consumer is live.
