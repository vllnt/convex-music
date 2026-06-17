/**
 * Auto-import sweep. Imports the **due** enabled sources (never imported, or past
 * their cadence) via the matching import entry point, bounded per run, stamping
 * each source's `lastImportedAt`. Opt-in by construction: no enabled sources →
 * no-op. (The rate-limiter throughput budget + stale-row refresh are follow-ups;
 * this is the new-source pull.)
 */

import { v } from "convex/values";
import { api } from "../_generated/api.js";
import type { Doc } from "../_generated/dataModel.js";
import { type ActionCtx, action } from "../_generated/server.js";
import type { Provider } from "../../shared.js";

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
