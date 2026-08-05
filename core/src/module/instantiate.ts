import { type Injector, Lifetime, type Token, tokenName } from "injectus";

import {
  getProviderKind,
  getProviderLifetime,
  getProviderToken,
} from "./deps.ts";
import { DecorifyBootstrapError } from "./errors.ts";
import type { ModuleGraph } from "./graph.ts";

/**
 * Construct every singleton so a broken wiring fails at boot, not at the first
 * request. Scoped and transient providers are left alone: they have no instance
 * until something asks for one.
 *
 * @throws {DecorifyBootstrapError} when a provider resolves to a Promise.
 */
export function instantiate(graph: ModuleGraph, injector: Injector): void {
  for (const node of graph.order) {
    for (const provider of [...node.providers, ...node.controllers]) {
      const kind = getProviderKind(provider);
      if (kind === "value" || kind === "existing") continue;
      if (getProviderLifetime(provider) !== Lifetime.Singleton) continue;

      const token: Token = getProviderToken(provider);
      const instance = injector.resolve(token);

      if (isThenable(instance)) {
        throw new DecorifyBootstrapError({
          code: "DECORIFY_E_ASYNC_FACTORY",
          module: node.ref.name,
          token: tokenName(token),
          message: `${tokenName(token)} resolved to a Promise. The injector resolves synchronously, so useFactory must be sync — await the value in a module's configuring method and import the DynamicModule it returns.`,
        });
      }
    }
  }
}

function isThenable(value: unknown): boolean {
  return (
    typeof (value as { then?: unknown } | null | undefined)?.then === "function"
  );
}
