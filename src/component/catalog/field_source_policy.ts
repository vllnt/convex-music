/**
 * Field-source projection (scalar mode). Given an entity's per-provider
 * `providers[]` provenance and a per-field {@link SourceSpec}, resolve which
 * provider supplies a field's value: `{ from }` (one provider) or `{ prefer }`
 * (ordered, first-available). Falls back to the entity's canonical field when the
 * chosen provider has no value. The subset / `from: "all"` map mode is deferred
 * (no consumer yet); this is the `{from}` + `{prefer}` scalar path. The artist
 * image policy is this applied to `imageUrl`.
 */

import type { Provider } from "../../shared.js";

/** How a single field's source provider(s) are chosen. */
export type SourceSpec = { from: Provider } | { prefer: Provider[] };

/**
 * Resolve a field from the policy-chosen provider's provenance entry, or the
 * fallback. Keyed by the open `Provider` union, so adding a provider only widens
 * the policy — never changes a field's resolved type (the N-proof principle).
 *
 * @param entries - the entity's per-provider provenance.
 * @param spec - the field's source policy (undefined → fallback).
 * @param getValue - extracts the field from a provenance entry.
 * @param fallback - the entity's canonical value when the source has none.
 */
export function projectField<E extends { provider: Provider }, V>(
  entries: readonly E[],
  spec: SourceSpec | undefined,
  getValue: (entry: E) => V | undefined,
  fallback: V | undefined,
): V | undefined {
  if (spec === undefined) return fallback;
  if ("from" in spec) {
    const entry = entries.find((e) => e.provider === spec.from);
    const value = entry === undefined ? undefined : getValue(entry);
    return value ?? fallback;
  }
  for (const prov of spec.prefer) {
    const entry = entries.find((e) => e.provider === prov);
    const value = entry === undefined ? undefined : getValue(entry);
    if (value !== undefined) return value;
  }
  return fallback;
}
