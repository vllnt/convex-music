<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `example/convex/_generated/ai/guidelines.md` first** for
important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->

# @vllnt/convex-music

`@vllnt/convex-music` is a provider-neutral, cached music catalog as a Convex component. It caches
normalized music facts — tracks, artists, albums — from many providers (Spotify, Apple Music, and
more) in its own sandboxed tables, behind one typed client API. It follows the vllnt Component
Standard (see the `convex-components` hub `.claude/rules/component-standard.md`). This file is the
canonical agent guide; `CLAUDE.md` is a verbatim mirror.

## Architecture

```
src/
├── shared.ts              # PROVIDER / ENTITY_KIND codes, NEVER_EXPIRES sentinel, shared types
├── test.ts                # convex-test registration helper (exported via "./test")
├── client/
│   ├── types.ts           # Public TS interfaces (CacheEntry, PutInput, EntryKey, Normalized*)
│   └── index.ts           # Music client class — the consumer-facing API
└── component/
    ├── mutations.ts        # put, invalidate, pruneExpired
    ├── queries.ts          # get, getByIsrc, stats
    ├── validators.ts       # provider, entityKind, *Value, cacheEntryFields, cacheEntryDoc
    ├── schema.ts           # cacheEntries table (by_lookup, by_isrc, by_expiry)
    └── convex.config.ts    # defineComponent("music")
```

## Ownership boundary

| Domain | Owner |
|--------|-------|
| Music catalog — `artists` / `tracks` / `playlists` (the music database) + raw `cacheEntries` | **Component** — sandboxed; the factual record, read by hosts via API |
| Import / sync / repair + sync-status lifecycle (over the catalog) | **Component** — writes its own catalog tables; composes `@convex-dev/workflow`/`workpool` |
| Provider ids / ISRC (opaque refs) | **Host** — supplies them; the component stores and indexes as-is |
| Provider credentials (Spotify/Apple keys, tokens) | **Host** — env vars in the host deployment; never persisted by the component |
| Editorial overrides + `sourceRefs` + frozen gameplay snapshot | **Host** — its own domain tables, referencing catalog rows by id / ISRC |
| Gameplay + game categories / attribution / genre→category taxonomy | **Host** — game domain; never baked into the component |
| Auth / access control | **Host** — gates the component's write methods behind its own mutations |

## Key design decisions

- **Owns the catalog (cache + music database).** The component holds durable `artists` / `tracks` /
  `playlists` tables — the factual music database — populated from providers (cache) and read by
  hosts via API. It IS the system of record for the factual catalog (this supersedes the earlier
  "cache, never replace"). The host no longer keeps its own copy of the raw catalog.
- **Three layers — provider-granular underneath, identity-unified on top (not a catalog per provider).**
  (1) **Raw cache** (`cacheEntries`): ephemeral TTL'd **per-provider rows** keyed `(catalog, kind,
  provider, externalId)`. (2) **Catalog**: durable, **one unified canonical entity per identity**
  (track by ISRC, artist by resolved id — MBID then name, album by id) with per-provider `providers[]`
  provenance — NOT one row per provider, NOT a view. (3) **View**: the field-source policy/profiles
  project per-field across `providers[]`. A catalog per provider is wrong — the field-source policy
  needs one entity holding all providers. Identity resolution (ISRC / MBID+name / id) is the merge
  (`catalog-store.4`). See `ROADMAP.md` › `catalog-store`.
- **Tier-0 boundary (stays host-side).** To remain a horizontal music-catalog component, the host
  keeps gameplay, **editorial overrides + `sourceRefs` + the frozen gameplay snapshot**, and game
  **categories / attribution / genre→category taxonomy**, referencing catalog rows by id / ISRC. App
  import rules that can't be config are host-side or a Tier-1 `vllnt/convex-gaming-music` — never
  baked into `convex-music`.
- **Import lives in the component.** Because the catalog is the component's own tables, the
  import/sync/repair engine + sync-status lifecycle run here (writing its own tables), driven by
  mount policy. It **composes** `@convex-dev/workflow` / `workpool`; it never re-implements them.
- **Catalog content is runtime + host-owned, not mount-config.** Mount config governs HOW (providers,
  TTLs, filters, schedule, image policy), never WHAT. The host populates the catalog at runtime via
  the import primitives + a generic `sources` registry; its *curated, categorized* definitions
  (which playlists/artists, genre rules, game categories/attribution) stay host-side and reconcile
  into the registry (like songtrivia's crons driving `PLAYLIST_DEFINITIONS`/`ArtistDefinition`). The
  component owns the generic "keep these synced" input, never the curated/categorized list. Sources
  are given by natural identifier — artist **name**, playlist **url**, track **ISRC**, or provider id
  (`targetMode`: `name`|`url`|`isrc`|`providerId`). A small `initialSources` mount seed is supported
  (zero-config bootstrap); a real evolving catalog uses the runtime `sources` registry + import
  primitives. "Fill" is a declaration — import is async/external, so the engine reconciles toward the
  sources (no synchronous "filled at mount"); `listSources` + sync-status report what's populated.
- **One component — no search/catalog split.** Search is *over the durable catalog*, and the catalog
  has ≥3 consumers (songtrivia full, spotzic artists, heardzic/bandzic tracks). A standalone
  `convex-music-search` would sever search from the catalog it queries for no consumer gain, so
  catalog + search + cache + import stay one component. (Revisit only if a real
  provider-search-without-catalog consumer appears — composition keeps it a clean later extraction.)
- **Daily selection: primitive here, assignment in the gaming layer.** The component offers a generic
  `selectEligible(kind, filter, weight, excludeIds)` query over its catalog (it owns the data). The
  daily-puzzle assignment — today's frozen answer, no-repeat-within-N, scheduling — is the shared
  daily-game engine's job (gameplay); it calls `selectEligible` and freezes the result host-side.
  `excludeIds` (recently-used) is gameplay data the host passes in; the component never tracks it.
- **Per-deployment data.** Component tables are sandboxed per mount — each app's catalog is its own
  data (shared schema + engine, isolated data), not a shared catalog across apps.
- **Multiple searches per host.** A search targets a **catalog** (the partition — see Multiple
  catalogs per mount); each catalog has its own kinds/providers/field-source policy, so "artists
  search" + "tracks search" are two catalogs in one mount. Within a catalog, use **named profiles**
  (presets) and/or a per-call policy. **Named mounts** remain for hard cross-deployment isolation
  (mount-safety holds either way).
- **Multiple catalogs per mount (opaque `catalog` dimension) — owner decision.** One
  `app.use(music, { catalogs: {…} })` holds N catalogs, each with its own config (kinds, providers,
  field-source policy, profiles, retention); plus runtime `createCatalog`/`listCatalogs`. Opaque
  `catalog` ref on every table + scoped indexes + scoped reads; a **default catalog** keeps
  single-catalog usage zero-config. **BLOCKING:** a non-scoped read must NEVER silently span catalogs
  — every catalog read carries the `catalog` id. Deliberate deviation from the fleet's default
  multi-mount lean, favoring host DX (one mount, one ref); native multi-mount still works for hard
  cross-deployment isolation. Other-domain catalogs (podcasts) out of scope. See `ROADMAP.md`
  › `catalog-store.6`.
- **Pluggable providers — one adapter, one internal schema.** Adding a provider is one adapter folder
  (`client` · `types` = the provider's RAW schema, private · `mappers` raw→internal · `impl`) + a
  registry entry — no core edits (open/closed). ONE internal normalized schema is the public contract;
  per-provider raw schemas stay private; provenance (`providers[]`) keeps per-provider values for the
  field-source policy. Provider ids are an open union. Never expose N public schemas.
- **Three provider levels — don't conflate.** (1) catalog `providers` (mount) = the universe a
  catalog aggregates; (2) import `providers`/`excludeProviders` (per import) = the subset to FETCH +
  store (⊆ catalog); (3) field-source policy (per read) = which provider(s) to PROJECT per field. Each
  import also takes a typed `ImportOptions` (provider select, traversal depth — artist `tracks` off/
  top-N/all + `albums`, playlist `tracks.limit`/`importArtists`, track `withArtists`/`withAlbum` —
  `mode` import/refresh/reimport/repair, `priority`), with per-catalog `defaultImport` + per-call
  override. See `ROADMAP.md` › `import-engine.7`.
- **Provider-neutral, not vendor-named.** Providers are adapters behind one interface; adding Deezer
  or MusicBrainz never changes the public API. The capability is "music catalog," not any one vendor
  — swapping the backing provider must never force a rename.
- **Typed facts, no `v.any()`.** Cached values are typed unions (`trackValue` / `artistValue` /
  `albumValue`). Provider-varying fields are optional (e.g. `popularity` is Spotify; `country` /
  `gender` / `members` / `debutYear` are MusicBrainz/Wikidata).
- **Field-source projection policy (every field, any subset, N-proof).** Search + catalog reads take
  a policy choosing entity **kinds**, **fields**, and — for **every field independently** — which
  provider(s) supply it: `{ from: "<p>" }` single · `{ prefer: [...] }` ordered-pick-one · `{ from:
  ["p1","p2","p3"] }` explicit subset (e.g. 3 of 4) · `{ from: "all", limit? }`. Multi-select returns
  a provider-keyed partial map `Partial<Record<Provider, V>>` — adding a 4th/5th provider only adds
  keys, never changes a field's type; single/`prefer` returns a scalar. Default at mount, override
  per call. Projects from per-provider provenance (`providers[]`); fully typed (no `v.any()`). The
  artist-image policy is this applied to `image`. See `ROADMAP.md` › `field-source-policy`.
- **Never-expires sentinel.** Entries without a TTL store `expiresAt = Number.MAX_SAFE_INTEGER` (a
  real number, not `undefined`) so the `by_expiry` index never sweeps a never-expiring row.
- **Read-time expiry + prune.** `get`/`getByIsrc` treat expired entries as misses; `pruneExpired`
  reclaims storage and is idempotent (bounded to expired rows), safe on a schedule.
- **Scope at 0.1.0 = raw cache core only.** The durable catalog (`catalog-store`), provider adapters
  (Apple V8 ES256 signer, Spotify, then Deezer/MusicBrainz/Wikidata), read-through fetch, the
  `import-engine`, `sync-lifecycle`, and artist-image auto-sync are all planned — see `ROADMAP.md`.
  Agents MUST NOT implement planned surface without an explicit instruction.

## Conventions

- Mutations in `mutations.ts`, queries in `queries.ts` (enforced by `@vllnt/eslint-config/convex`).
- Explicit `args` + `returns` on every Convex function.
- Sandboxed tables only (`cacheEntries` today; `artists`/`tracks`/`playlists` catalog planned) — the component never reads host or sibling tables.
- No bare `v.any()` — host data is typed via the `*Value` validators.
- 100% test coverage is BLOCKING (`vitest.config.mts` thresholds).
- Runtime deps: only official `@convex-dev/*` + `@vllnt/*`. The provider-fetch phase composes
  `@convex-dev/action-cache` / `action-retrier` / `rate-limiter` as child components — never
  hand-rolled. A component runs in V8: Apple's ES256 JWT must use Web Crypto, not `jsonwebtoken`.
- Provider env vars (Convex environment variables, set on the host deployment): Spotify
  `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`; Apple `APPLE_MUSIC_ISSUER` / `APPLE_MUSIC_KID` /
  `APPLE_MUSIC_PRIVATE_KEY` (sourced from songtrivia's backend). Enabled-providers + preference is
  mount policy, superseding songtrivia's `SPOTIFY_ONLY` / `APPLE_ONLY` toggles.
- Resilience: retry `429` **and** overload `5xx` (incl. `529` / `503`) — honor `Retry-After`, capped
  backoff + jitter, per-request timeout, bounded concurrency. songtrivia retries only `429`; the
  component must also survive provider overload (`529`) so an import never hard-fails on it.
- Automation (`auto-import`): **opt-in, off by default.** Two modes on one cursored, idempotent,
  per-mount cron — **import** (pull NEW sources) and **sync/refresh** (keep EXISTING rows current per
  a `refresh` freshness config: per-kind, optionally per-field staleAfter — volatile `popularity`
  refreshes faster than static facts). Throughput is a configurable **budget** ("2 artists/hour") via
  a `@convex-dev/rate-limiter` token bucket per `(catalog, kind)`, decoupled from cron frequency,
  separate budgets for import vs refresh — all distinct from the provider-API 429/529 rate.
  `sync-lifecycle` is the mechanism; this is the policy. See `ROADMAP.md` › `auto-import`.

## Docs sync

When any of these change, update the matching docs in the SAME commit (then `pnpm generate:llms`):

| Change | Update |
|--------|--------|
| Client method signature (`src/client/index.ts`) | `docs/API.md`, README API table, `llms.txt` context, regenerate `llms-full.txt` |
| Schema / table fields (`src/component/schema.ts`) | this file (Architecture), `docs/API.md` Types |
| New feature / breaking change | `CHANGELOG.md`, README Features, `ROADMAP.md` |
| `peerDependencies.convex` range | `llms.txt` context line, `docs/API.md` Compatibility line |
| New planned capability | tag `[planned]` in README; do NOT add to `docs/API.md` or `llms-full.txt` source |
