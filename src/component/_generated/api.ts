/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions from "../actions.js";
import type * as catalog_browse_order from "../catalog/browse_order.js";
import type * as catalog_merge from "../catalog/merge.js";
import type * as catalog_mutations from "../catalog/mutations.js";
import type * as catalog_queries from "../catalog/queries.js";
import type * as config_mutations from "../config/mutations.js";
import type * as config_queries from "../config/queries.js";
import type * as imports_dedupe from "../imports/dedupe.js";
import type * as imports_mutations from "../imports/mutations.js";
import type * as imports_queries from "../imports/queries.js";
import type * as imports_state from "../imports/state.js";
import type * as mutations from "../mutations.js";
import type * as providers_actions from "../providers/actions.js";
import type * as providers_apple_impl from "../providers/apple/impl.js";
import type * as providers_apple_jwt from "../providers/apple/jwt.js";
import type * as providers_apple_mappers from "../providers/apple/mappers.js";
import type * as providers_apple_types from "../providers/apple/types.js";
import type * as providers_fetch from "../providers/fetch.js";
import type * as providers_registry from "../providers/registry.js";
import type * as providers_spotify_client from "../providers/spotify/client.js";
import type * as providers_spotify_impl from "../providers/spotify/impl.js";
import type * as providers_spotify_mappers from "../providers/spotify/mappers.js";
import type * as providers_spotify_types from "../providers/spotify/types.js";
import type * as providers_types from "../providers/types.js";
import type * as queries from "../queries.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  actions: typeof actions;
  "catalog/browse_order": typeof catalog_browse_order;
  "catalog/merge": typeof catalog_merge;
  "catalog/mutations": typeof catalog_mutations;
  "catalog/queries": typeof catalog_queries;
  "config/mutations": typeof config_mutations;
  "config/queries": typeof config_queries;
  "imports/dedupe": typeof imports_dedupe;
  "imports/mutations": typeof imports_mutations;
  "imports/queries": typeof imports_queries;
  "imports/state": typeof imports_state;
  mutations: typeof mutations;
  "providers/actions": typeof providers_actions;
  "providers/apple/impl": typeof providers_apple_impl;
  "providers/apple/jwt": typeof providers_apple_jwt;
  "providers/apple/mappers": typeof providers_apple_mappers;
  "providers/apple/types": typeof providers_apple_types;
  "providers/fetch": typeof providers_fetch;
  "providers/registry": typeof providers_registry;
  "providers/spotify/client": typeof providers_spotify_client;
  "providers/spotify/impl": typeof providers_spotify_impl;
  "providers/spotify/mappers": typeof providers_spotify_mappers;
  "providers/spotify/types": typeof providers_spotify_types;
  "providers/types": typeof providers_types;
  queries: typeof queries;
  validators: typeof validators;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {
  actionCache: import("@convex-dev/action-cache/_generated/component.js").ComponentApi<"actionCache">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
