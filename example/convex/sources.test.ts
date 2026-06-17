/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api.js";
import schema from "./schema.js";
import { register } from "../../src/test.js";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  const t = convexTest(schema, modules);
  register(t);
  return t;
}

test("addSource defaults enabled, listSources filters, setSourceEnabled toggles, removeSource deletes", async () => {
  const t = setup();
  const a = await t.mutation(api.example.addSource, {
    kind: "artist",
    by: "name",
    value: "Daft Punk",
    withTracks: true,
  });
  const b = await t.mutation(api.example.addSource, {
    kind: "playlist",
    by: "providerId",
    value: "pl1",
    provider: "spotify",
    enabled: false,
  });

  const all = await t.query(api.example.listSources, {});
  expect(all).toHaveLength(2);

  const enabled = await t.query(api.example.listSources, {
    enabledOnly: true,
    limit: 10,
  });
  expect(enabled.map((s: { value: string }) => s.value)).toEqual(["Daft Punk"]);

  await t.mutation(api.example.setSourceEnabled, { sourceId: b, enabled: true });
  expect(await t.query(api.example.listSources, { enabledOnly: true })).toHaveLength(
    2,
  );

  await t.mutation(api.example.removeSource, { sourceId: a });
  expect(await t.query(api.example.listSources, {})).toHaveLength(1);
});
