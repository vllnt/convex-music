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
| `cacheEntries` table (normalized provider facts) | **Component** — sandboxed, never reached by host or siblings |
| Provider ids / ISRC (opaque refs) | **Host** — supplies them; the component stores and indexes as-is |
| Provider credentials (Spotify/Apple keys, tokens) | **Host** — env vars in the host deployment; never enter the component cache |
| The curated, gameplay/editorial copy of music data | **Host** — its own domain tables; the cache never replaces them |
| Auth / access control | **Host** — gates `put` / `invalidate` / `pruneExpired` behind its own mutations |
| TTL / freshness / expiry | **Component** — per-entry `expiresAt`, read-time miss on expiry, prune sweep |

## Key design decisions

- **Cache, never replace.** The component is an acceleration layer in front of external providers,
  not a system of record. Hosts persist their own curated/editorial copy in their own tables and
  read through the cache; the cache holds only public provider facts with a TTL. This keeps the
  component domain-neutral (a stranger's app can use it) and keeps host domain opinions out of it.
- **Per-deployment cache.** Component tables are sandboxed per mount/deployment — the cache dedupes
  provider calls *within* one app; it is not a shared catalog across separate apps. Document this so
  consumers don't expect cross-app sharing.
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
- **Scope at 0.1.0 = cache core.** Provider fetch/search adapters (the V8 ES256 signer for Apple,
  Spotify client-credentials, then Deezer/MusicBrainz/Wikidata) and the artist-image auto-sync
  policy are planned — see `ROADMAP.md`. Agents MUST NOT implement planned surface without an
  explicit instruction.

## Conventions

- Mutations in `mutations.ts`, queries in `queries.ts` (enforced by `@vllnt/eslint-config/convex`).
- Explicit `args` + `returns` on every Convex function.
- Sandboxed `cacheEntries` table only — the component never reads host or sibling tables.
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
