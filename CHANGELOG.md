# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - Unreleased

### Fixed

- Reject invalid input with typed `ConvexError`s instead of storing bad rows or silently dropping
  results: non-finite `ttlMs` on `put` (`INVALID_TTL`), non-positive-integer `limit` / `scanLimit` /
  `count` on searches, `selectEligible`, album/playlist imports, the refresh and auto-import sweeps and
  `consumeBudget` (`INVALID_LIMIT`, `INVALID_COUNT`), non-positive `cadenceMs` on `addSource`
  (`INVALID_CADENCE`), and empty identifiers on `put` and the catalog upserts / `addSource`
  (`INVALID_ARGUMENT`). Error codes are listed in `docs/API.md`.

### Changed

- Unit-test files are no longer included in the published tarball.
- Update `@convex-dev/rate-limiter` to `^0.4.2` and refresh the dev toolchain.
- Document how to use the `/test` entry in a consuming app (needs `convex-test` and `vitest`).

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
