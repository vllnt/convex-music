/**
 * Auto-import sweep. Imports the **due** enabled sources (never imported, or past
 * their cadence) via the matching import entry point, bounded per run, stamping
 * each source's `lastImportedAt`. Opt-in by construction: no enabled sources →
 * no-op. (The rate-limiter throughput budget + stale-row refresh are follow-ups;
 * this is the new-source pull.)
 */

import { HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { api, components } from "../_generated/api.js";
import type { Doc } from "../_generated/dataModel.js";
import { type ActionCtx, action } from "../_generated/server.js";
import type { Provider } from "../../shared.js";

/**
 * Auto-import throughput budgets — token buckets decoupled from cron frequency,
 * separate for new-source import vs stale-row refresh. Default 60/hour each.
 */
export const AUTO_IMPORT_RATE_PER_HOUR = 60;
const rateLimiter = new RateLimiter(components.rateLimiter, {
  autoImport: { kind: "token bucket", rate: AUTO_IMPORT_RATE_PER_HOUR, period: HOUR },
  refresh: { kind: "token bucket", rate: AUTO_IMPORT_RATE_PER_HOUR, period: HOUR },
});

/** Whether a source is due: never imported, or past its cadence (one-shot if no cadence). */
function isDue(source: Doc<"sources">, now: number): boolean {
  if (source.lastImportedAt === undefined) return true;
  if (source.cadenceMs === undefined) return false;
  return now - source.lastImportedAt > source.cadenceMs;
}

/** Dispatch a source to its import entry point. */
async function importSource(
  ctx: ActionCtx,
  source: Doc<"sources">,
  prov: Provider,
): Promise<void> {
  if (source.kind === "artist") {
    await ctx.runAction(api.imports.actions.importArtist, {
      provider: prov,
      targetMode: source.by === "name" ? "name" : "providerId",
      name: source.by === "name" ? source.value : undefined,
      providerId: source.by === "name" ? undefined : source.value,
      withTracks: source.withTracks,
    });
  } else if (source.kind === "track") {
    await ctx.runAction(api.imports.actions.importTrack, {
      provider: prov,
      providerId: source.value,
    });
  } else {
    await ctx.runAction(api.imports.actions.importPlaylist, {
      provider: prov,
      providerId: source.value,
    });
  }
}

/**
 * Run the refresh sweep: re-import up to `limit` stale catalog rows of a kind
 * from each provider already on their record (mode `refresh`), bringing them
 * back to `synced`. The freshness mechanism `markStale` flips rows to `stale`;
 * this re-syncs them. Opt-in by construction (no stale rows → no-op).
 */
export const runRefresh = action({
  args: {
    kind: v.union(v.literal("artist"), v.literal("track")),
    limit: v.optional(v.number()),
  },
  returns: v.object({ refreshed: v.number() }),
  handler: async (ctx, args): Promise<{ refreshed: number }> => {
    const limit = args.limit ?? 10;
    const stale = await ctx.runQuery(api.sync.queries.listStale, {
      kind: args.kind,
      limit,
    });
    let refreshed = 0;
    for (const row of stale) {
      // Separate refresh budget (distinct from the new-source import budget).
      const { ok } = await rateLimiter.limit(ctx, "refresh");
      if (!ok) break;
      if (args.kind === "artist") {
        await Promise.all(
          row.providers.map((prov) =>
            ctx.runAction(api.imports.actions.importArtist, {
              provider: prov.provider,
              targetMode: "providerId",
              providerId: prov.providerId,
              mode: "refresh",
            }),
          ),
        );
      } else {
        await Promise.all(
          row.providers.map((prov) =>
            ctx.runAction(api.imports.actions.importTrack, {
              provider: prov.provider,
              providerId: prov.providerId,
              mode: "refresh",
            }),
          ),
        );
      }
      refreshed += 1;
    }
    return { refreshed };
  },
});

/**
 * Run the auto-import sweep: import up to `limit` due enabled sources, stamping
 * each. Sources with no provider are skipped. Returns `{ imported, skipped }`.
 */
export const runAutoImport = action({
  args: { limit: v.optional(v.number()), now: v.optional(v.number()) },
  returns: v.object({ imported: v.number(), skipped: v.number() }),
  handler: async (ctx, args): Promise<{ imported: number; skipped: number }> => {
    const now = args.now ?? Date.now();
    const limit = args.limit ?? 10;
    const sources = await ctx.runQuery(api.sources.queries.listSources, {
      enabledOnly: true,
      limit: 100,
    });
    const due = sources.filter((source) => isDue(source, now)).slice(0, limit);
    let imported = 0;
    let skipped = 0;
    for (const source of due) {
      if (source.provider === undefined) {
        skipped += 1;
        continue;
      }
      // Throughput budget: stop the sweep when the token bucket is drained
      // (decoupled from how often the cron fires).
      const { ok } = await rateLimiter.limit(ctx, "autoImport");
      if (!ok) break;
      await importSource(ctx, source, source.provider);
      await ctx.runMutation(api.sources.mutations.touchSource, {
        sourceId: source._id,
        now,
      });
      imported += 1;
    }
    return { imported, skipped };
  },
});

/**
 * Consume `count` tokens from a named throughput budget (`autoImport` or
 * `refresh`) — for host-side pacing (reserve budget before a manual burst).
 * Returns whether the budget allowed it.
 */
export const consumeBudget = action({
  args: {
    budget: v.union(v.literal("autoImport"), v.literal("refresh")),
    count: v.number(),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const { ok } = await rateLimiter.limit(ctx, args.budget, {
      count: args.count,
    });
    return ok;
  },
});
