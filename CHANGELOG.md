# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Changed

- Track facts now carry `genres` (Apple) + `popularity` (Spotify), folded across providers; track
  `popularity` scales sync staleness.

> Unreleased: the catalog engine above is built on the feature branch but not yet in a stable
> release — published versions stay `0.1.0`/canary until the first stable cut.

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
