import type { Constructor } from "injectus";

import type { ModuleGraph } from "./graph.ts";

/** A controller together with the module that declared it. */
export interface ControllerRef {
  ref: Constructor;
  module: Constructor;
}

export function collectControllers(graph: ModuleGraph): ControllerRef[] {
  const refs: ControllerRef[] = [];
  for (const node of graph.order) {
    for (const ref of node.controllers) {
      refs.push({ ref, module: node.ref });
    }
  }
  return refs;
}
