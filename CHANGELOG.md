# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - Unreleased

### Added

- The npm package now ships `docs/API.md`, `CHANGELOG.md` and `llms.txt`, so the docs in
  `node_modules/@vllnt/convex-music/` match the installed version. `llms.txt` links the bundled
  files with relative paths, and a test fails when a required file is missing from the tarball.
- `docs/API.md` documents the entry points and the public component functions that have no
  `Music` client method.

### Changed

- **Breaking:** eight worker functions that only the component itself calls are now
  `internalQuery` / `internalMutation` / `internalAction`, so a host can no longer call them through
  `components.music`: `catalog.queries.getArtistByProvider`, `catalog.queries.getTrackByProvider`,
  `imports.actions.runArtistImport`, `imports.actions.runTrackImport`,
  `imports.actions.runPlaylistImport`, `imports.actions.runAlbumImport`,
  `sources.mutations.touchSource` and `sync.mutations.claimNextStale`. None is on the `Music` client or
  in `docs/API.md`; use `importArtist` / `importTrack` / `importPlaylist` / `importAlbum` and
  `fetchArtist` / `fetchTrack` instead. A breaking change in a `0.x` package ships as a minor, so this
  release is `0.2.0`.
- Unit-test files are no longer included in the published tarball.
- Update `@convex-dev/rate-limiter` to `^0.4.2` and refresh the dev toolchain.
- Document how to use the `/test` entry in a consuming app (needs `convex-test` and `vitest`).
- Every push to `main` that changes the package or its shipped docs publishes a `canary` build;
  it no longer depends on a repository variable.
- Import entry points run their traversal in the same action instead of a nested
  `ctx.runAction` (-1 action invocation per import, and per auto-import / refresh source), and
  name-targeted artist imports search through the adapter directly (-1 more action).
- Import requests move `queued -> claimed -> running` in one internal mutation (-1 mutation call
  per import).
- Imported tracks are upserted in batches of up to 50 per mutation instead of one mutation per
  track (an artist `tracks: "all"` import of 120 tracks: 3 mutation calls instead of 120). A
  failing track no longer blocks the rest of its batch; the import still reports the first error.
- The hourly auto-import cron runs a mutation that schedules the auto-import action only when an
  enabled source is due, so an idle deployment runs no action.
- Dependency updates: runtime `@convex-dev/action-cache` 0.3.2; development `convex` 1.51.0,
  `convex-test` 0.0.73, `vitest` / `@vitest/coverage-v8` 5.1.1, `eslint` 10, `jsdom` 31 and
  `@vllnt/typescript` 3 (its new strictness flags are on, except `exactOptionalPropertyTypes`,
  which would change the public types). The `ws` override moves to ^8.23.0 for
  GHSA-37g9-w4hg-h9qr (dev-only, through the `convex` CLI). The `convex` peer range is unchanged.

### Fixed

- Reject invalid input with typed `ConvexError`s instead of storing bad rows or silently dropping
  results: non-finite `ttlMs` on `put` (`INVALID_TTL`), non-positive-integer `limit` / `scanLimit` /
  `count` on searches, `selectEligible`, album/playlist imports, the refresh and auto-import sweeps and
  `consumeBudget` (`INVALID_LIMIT`, `INVALID_COUNT`), non-positive `cadenceMs` on `addSource`
  (`INVALID_CADENCE`), and empty identifiers on `put` and the catalog upserts / `addSource`
  (`INVALID_ARGUMENT`). Error codes are listed in `docs/API.md`.
- Docs drift: `NormalizedTrack` lists `genres`, `popularity` and `albumId`; `recoverStuckSyncs` is no
  longer listed as throwing `INVALID_LIMIT`; `addSource` lists the targets the sweep imports; the
  README track example includes the required `genres`.
- `ImportPlaylistInput` and `ImportAlbumInput` no longer accept `withAlbum`. The component's
  `importPlaylist` / `importAlbum` validators never accepted it, so a call that set it type-checked
  but failed at runtime with an extra-field error. `withAlbum` stays on `ImportTrackInput`.
- `CHANGELOG.md` keeps one section for the next version: a test fails when an `[Unreleased]`
  section sits beside it or when the `package.json` version has no section.

## [0.1.0] - 2026-09-01

### Added

- First release of `@vllnt/convex-music` — a provider-neutral, cached music catalog as a sandboxed
  Convex component.
- Durable catalog store: unified `artists` / `tracks` / `playlists` / `albums` tables with
  per-provider `providers[]` provenance, identity merge, the field-source projection policy, and a
  daily-rotation `selectEligible` primitive.
- Provider adapters behind one interface — Spotify, Apple Music (V8 Web-Crypto ES256 developer
  token), Deezer, MusicBrainz, Wikidata — plus a resilient `fetchJson` (429 + overload retry,
  `Retry-After`, capped backoff + jitter, per-request timeout) and bounded `mapWithConcurrency`.
- Read-through fetch (`fetch`, `search`, `resolveByIsrc`) and the import engine (`importArtist` /
  `importTrack` / `importPlaylist` / `importAlbum`) over a component-owned, guarded request
  control-plane with dedup.
- Sync lifecycle (freshness `mark-stale` → atomic `claimNextStale` refresh → stuck-sync recovery),
  opt-in auto-import with per-budget rate limiting, and a runtime `sources` registry.
- Credential seam (`configure`) storing provider secrets in a sandboxed `providerConfig` table,
  read only inside the component's token actions; optional tree-shakeable `./react` hooks.
- Cache core: a sandboxed `cacheEntries` table holding normalized track / artist / album facts,
  keyed by `(kind, provider, externalId)` with a `by_isrc` cross-reference and a `by_expiry` index.
- `Music` client class: `put`, `get`, `getByIsrc`, `invalidate`, `pruneExpired`, `stats`.
- Per-entry TTL (`ttlMs`) with a never-expires sentinel; expired entries read as cache misses and
  are reclaimed by the idempotent `pruneExpired` sweep.
- `example/convex/` host-app harness with 100% end-to-end coverage via `convex-test` (happy path
  plus expired-entry, unknown-key, and cross-provider ISRC paths).

### Changed

- Make freshness maintenance query indexed `nextSyncAt` due rows so fresh rows cannot starve stale
  detection, and make cache pruning/stats bounded via self-draining batches plus a maintained count.
- Track facts now carry `genres` (Apple) + `popularity` (Spotify), folded across providers; track
  `popularity` scales sync staleness.
- Treat Convex `_generated` output as CLI-owned, exclude it from formatting, and expose a
  dedicated codegen script.
- Refresh all direct dependencies to their latest compatible releases for canary validation.
- Require `convex@^1.45.0`, update `convex-test` to `^0.0.56`, and update
  `@convex-dev/action-cache` to `^0.3.1`.

### Fixed

- Dispatch registered sources only to compatible import APIs, including albums, and leave failed
  imports due for retry instead of marking them imported.
- Recover abandoned import requests so dead deduplication rows cannot block future work, prune
  terminal request history after 30 days, and rotate provider token-cache keys with credentials.
- Detect truncated provider album/playlist membership and merge newly observed tracks into existing
  membership instead of destructively replacing it with a partial page or caller-limited import.
- Reconcile the maintained cache counter for pre-upgrade rows in bounded batches, and heartbeat
  running imports so abandoned-request recovery does not invalidate healthy traversals.
