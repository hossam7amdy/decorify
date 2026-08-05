import type { Provider as InjectorProvider } from "injectus";
import { Injector } from "injectus";

import type { ModuleGraph } from "./graph.ts";
import { toInjectorProvider } from "./provider.ts";

/**
 * Flatten every module's providers and controllers into a single root injector.
 *
 * This is the only place decorify creates an injector. Adapters may create
 * request-scoped children parented to it.
 */
export function compile(graph: ModuleGraph): Injector {
  const providers: InjectorProvider[] = [];

  for (const node of graph.order) {
    for (const provider of node.providers) {
      providers.push(toInjectorProvider(provider));
    }
    for (const controller of node.controllers) {
      providers.push(toInjectorProvider(controller));
    }
  }

  return Injector.create({ providers, name: "decorify" });
}
