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
  component owns the generic "keep these synced" input, never the curated/categorized list.
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
- **Provider-neutral, not vendor-named.** Providers are adapters behind one interface; adding Deezer
  or MusicBrainz never changes the public API. The capability is "music catalog," not any one vendor
  — swapping the backing provider must never force a rename.
- **Typed facts, no `v.any()`.** Cached values are typed unions (`trackValue` / `artistValue` /
  `albumValue`). Provider-varying fields are optional (e.g. `popularity` is Spotify; `country` /
  `gender` / `members` / `debutYear` are MusicBrainz/Wikidata).
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

## Docs sync

When any of these change, update the matching docs in the SAME commit (then `pnpm generate:llms`):

| Change | Update |
|--------|--------|
| Client method signature (`src/client/index.ts`) | `docs/API.md`, README API table, `llms.txt` context, regenerate `llms-full.txt` |
| Schema / table fields (`src/component/schema.ts`) | this file (Architecture), `docs/API.md` Types |
| New feature / breaking change | `CHANGELOG.md`, README Features, `ROADMAP.md` |
| `peerDependencies.convex` range | `llms.txt` context line, `docs/API.md` Compatibility line |
| New planned capability | tag `[planned]` in README; do NOT add to `docs/API.md` or `llms-full.txt` source |
