import { type Lifetime, tokenName } from "injectus";

import {
  getProviderDeps,
  getProviderKind,
  getProviderLifetime,
  getProviderToken,
  type ProviderKind,
} from "./deps.ts";
import type { ModuleGraph } from "./graph.ts";

/** One provider, rendered for tooling. */
export interface SerializedProvider {
  token: string;
  kind: ProviderKind;
  lifetime: Lifetime;
  deps: string[];
}

/** One module, rendered for tooling. */
export interface SerializedModule {
  name: string;
  dynamic: boolean;
  imports: string[];
  providers: SerializedProvider[];
  controllers: string[];
  exports: string[];
}

/** The whole graph as plain JSON. */
export interface SerializedGraph {
  root: string;
  modules: SerializedModule[];
}

/**
 * Render a graph as stable JSON.
 *
 * Every list is sorted by name, so repeated runs over unchanged source produce
 * byte-identical output and the artifact diffs cleanly in review.
 */
export function snapshot(graph: ModuleGraph): SerializedGraph {
  const modules: SerializedModule[] = [];

  for (const node of graph.nodes.values()) {
    modules.push({
      name: node.ref.name,
      dynamic: node.dynamic,
      imports: node.imports.map((ref) => ref.name).sort(compare),
      providers: node.providers
        .map((provider) => ({
          token: tokenName(getProviderToken(provider)),
          kind: getProviderKind(provider),
          lifetime: getProviderLifetime(provider),
          deps: getProviderDeps(provider)
            .map((token) => tokenName(token))
            .sort(compare),
        }))
        .sort((left, right) => compare(left.token, right.token)),
      controllers: node.controllers.map((ref) => ref.name).sort(compare),
      exports: node.exports.map((token) => tokenName(token)).sort(compare),
    });
  }

  modules.sort((left, right) => compare(left.name, right.name));
  // A configured root arrives as a DynamicModule; name it by the class it wraps
  // so a snapshot reads the same however the root was entered.
  const root =
    typeof graph.root === "function" ? graph.root : graph.root.module;
  return { root: root.name, modules };
}

function compare(left: string, right: string): number {
  return left < right ? -1 : 1;
}
