<!-- Badges -->

[![Convex Component](https://img.shields.io/badge/convex-component-EE342F.svg)](https://convex.dev/components)
[![npm](https://img.shields.io/npm/v/@vllnt/convex-music.svg)](https://www.npmjs.com/package/@vllnt/convex-music)
[![CI](https://github.com/vllnt/convex-music/actions/workflows/ci.yml/badge.svg)](https://github.com/vllnt/convex-music/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@vllnt/convex-music.svg)](LICENSE)

# @vllnt/convex-music

A provider-neutral, cached music catalog for Convex apps — look up tracks, artists, and albums
from Spotify, Apple Music, and more through one typed API, with results cached in the component's
own sandboxed tables.

```ts
const music = new Music(components.music);

// Cache a provider's normalized facts for an entity (TTL-bounded)…
await music.put(ctx, { kind: "track", provider: "spotify", externalId: id, isrc, value });
// …then read it back fast on the next request.
const hit = await music.get(ctx, { kind: "track", provider: "spotify", externalId: id });
```

## Features

- One typed API across providers — Spotify and Apple Music today; Deezer, MusicBrainz, and
  Wikidata as drop-in adapters.
- Sandboxed cache tables with a per-entry TTL — dedupe provider calls and ease rate limits.
- Tracks, artists, and albums, cached by opaque provider id and cross-referenced by ISRC.
- `getByIsrc` resolves the same recording across every provider you've cached.
- `pruneExpired` is an idempotent sweep, safe to run on a schedule.
- Caches only public catalog facts; your app keeps its own curated tables — the cache never
  replaces them.
- `[planned]` Provider fetch/search adapters (`search`, `getTrack` / `getArtist` / `getAlbum`).
- `[planned]` Artist-image auto-sync with a configurable provider-selection policy.

## Installation

```bash
npm install @vllnt/convex-music
```

Requires `convex@^1.36.1` as a peer dependency.

## Usage

Mount the component in your app's `convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import music from "@vllnt/convex-music/convex.config";

const app = defineApp();
app.use(music);
export default app;
```

Then use the client from your own queries and mutations. The host owns auth — gate the write
methods behind your own authorized functions, and persist results into your own domain tables:

```ts
import { Music } from "@vllnt/convex-music";
import { components } from "./_generated/api";

const music = new Music(components.music);

export const cacheTrack = internalMutation({
  args: { externalId: v.string(), isrc: v.string(), value: trackValue },
  handler: (ctx, args) =>
    music.put(ctx, {
      kind: "track",
      provider: "spotify",
      externalId: args.externalId,
      isrc: args.isrc,
      value: args.value,
      ttlMs: 1000 * 60 * 60 * 24, // refresh daily
    }),
});
```

## API Reference

| Method | Kind | Description |
| --- | --- | --- |
| `put(ctx, input)` | mutation | Cache (insert or refresh) one provider's facts; returns the entry id. |
| `get(ctx, key)` | query | Fetch one cached entry, or `null` if missing or expired. |
| `getByIsrc(ctx, isrc)` | query | Every fresh cached track for an ISRC, across providers. |
| `invalidate(ctx, key)` | mutation | Drop one cached entry; returns whether a row was deleted. |
| `pruneExpired(ctx)` | mutation | Delete every expired entry; returns the count removed. |
| `stats(ctx)` | query | Count of cached entries. |

Full reference — signatures, value shapes, and error codes: [`docs/API.md`](docs/API.md).

## Security

- The component caches only public catalog facts — no secrets or credentials are stored.
- Provider credentials live in the host's environment; they never reach the client.
- The host gates every write method behind its own authorized functions.

See [`SECURITY.md`](SECURITY.md) for vulnerability reporting.

## Testing

```bash
pnpm test            # vitest + convex-test + @edge-runtime/vm
pnpm test:coverage   # 100% coverage gate
```

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Issues and pull requests welcome.

## Author

Built by [bntvllnt](https://github.com/bntvllnt) · [bntvllnt.com](https://bntvllnt.com) · [X @bntvllnt](https://x.com/bntvllnt)

Part of the [@vllnt](https://github.com/vllnt) Convex component fleet — [vllnt.com](https://vllnt.com)

If this is useful, [sponsor the work](https://github.com/sponsors/bntvllnt).

## License

MIT — see [LICENSE](LICENSE).
