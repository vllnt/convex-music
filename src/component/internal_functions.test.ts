import { expect, test } from "vitest";
import * as catalogQueries from "./catalog/queries.js";
import * as importActions from "./imports/actions.js";
import * as sourceMutations from "./sources/mutations.js";
import * as syncMutations from "./sync/mutations.js";

/** Runtime visibility markers Convex sets on every registered function. */
interface Registered {
  isPublic?: boolean;
  isInternal?: boolean;
}

/**
 * Worker primitives only the component itself calls (the import traversals, the
 * auto-import and refresh sweeps). They must stay `internal*`: a public function
 * is part of the component API that hosts can call across the boundary.
 */
const workerFunctions: Record<string, Registered> = {
  "catalog.queries.getArtistByProvider": catalogQueries.getArtistByProvider,
  "catalog.queries.getTrackByProvider": catalogQueries.getTrackByProvider,
  "imports.actions.runArtistImport": importActions.runArtistImport,
  "imports.actions.runTrackImport": importActions.runTrackImport,
  "imports.actions.runPlaylistImport": importActions.runPlaylistImport,
  "imports.actions.runAlbumImport": importActions.runAlbumImport,
  "sources.mutations.touchSource": sourceMutations.touchSource,
  "sync.mutations.claimNextStale": syncMutations.claimNextStale,
};

test.each(Object.entries(workerFunctions))("%s is internal", (_name, fn) => {
  expect(fn.isInternal).toBe(true);
  expect(fn.isPublic).toBeUndefined();
});
