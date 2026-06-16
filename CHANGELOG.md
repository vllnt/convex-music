# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [0.1.0] - 2026-06-16

### Added

- First release of `@vllnt/convex-music` — a provider-neutral, cached music catalog as a sandboxed
  Convex component.
- Cache core: a sandboxed `cacheEntries` table holding normalized track / artist / album facts,
  keyed by `(kind, provider, externalId)` with a `by_isrc` cross-reference and a `by_expiry` index.
- `Music` client class: `put`, `get`, `getByIsrc`, `invalidate`, `pruneExpired`, `stats`.
- Per-entry TTL (`ttlMs`) with a never-expires sentinel; expired entries read as cache misses and
  are reclaimed by the idempotent `pruneExpired` sweep.
- `example/convex/` host-app harness with 100% end-to-end coverage via `convex-test` (happy path
  plus expired-entry, unknown-key, and cross-provider ISRC paths).

> Provider fetch/search adapters (Spotify, Apple Music, then Deezer / MusicBrainz / Wikidata) and
> the artist-image auto-sync policy sketched in the README and ROADMAP are planned for follow-up
> releases.
