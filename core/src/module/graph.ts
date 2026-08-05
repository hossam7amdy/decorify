import type { Constructor, Token } from "injectus";

import type { ModuleEntry } from "../interfaces/module.interface.ts";
import type { Provider } from "../interfaces/provider.interface.ts";
import type { DecorifyError } from "./errors.ts";

/** One module in the application graph, with its metadata fully resolved. */
export interface ModuleNode {
  ref: Constructor;
  /** Imported modules, resolved to their class references. */
  imports: Constructor[];
  providers: Provider[];
  controllers: Constructor[];
  exports: Token[];
  /** True when this node's metadata came from a `DynamicModule`. */
  dynamic: boolean;
}

/** The whole application graph, produced by `discover`. */
export interface ModuleGraph {
  root: Awaited<ModuleEntry>;
  nodes: ReadonlyMap<Constructor, ModuleNode>;
  /**
   * Every node, imports before importers. Empty when a cycle exists.
   *
   * Holds nodes rather than refs so consumers never have to re-look-up a
   * module that is guaranteed to be present.
   */
  order: readonly ModuleNode[];
  /** Problems found while discovering the graph. Folded in by `validate`. */
  issues: readonly DecorifyError[];
}

/** Outcome of a topological sort: an order, or the cycle that prevented one. */
export interface TopoResult {
  order: readonly ModuleNode[];
  /** Refs forming a cycle, with the first ref repeated at the end. Empty when acyclic. */
  cycle: readonly Constructor[];
}

/**
 * Sort modules so every module appears after the modules it imports.
 *
 * Returns an empty `order` and a populated `cycle` when the graph is cyclic.
 * Iteration follows the map's insertion order, so the result is deterministic.
 * An import with no entry in `nodes` is skipped rather than emitted.
 */
export function topoSort(
  nodes: ReadonlyMap<Constructor, ModuleNode>,
): TopoResult {
  const order: ModuleNode[] = [];
  const state = new Map<Constructor, "open" | "done">();
  const stack: Constructor[] = [];
  let cycle: readonly Constructor[] = [];

  const visit = (ref: Constructor): boolean => {
    const seen = state.get(ref);
    if (seen === "done") return true;
    if (seen === "open") {
      cycle = [...stack.slice(stack.indexOf(ref)), ref];
      return false;
    }

    state.set(ref, "open");
    const node = nodes.get(ref);
    if (node) {
      stack.push(ref);
      for (const dep of node.imports) {
        if (!visit(dep)) return false;
      }
      stack.pop();
      order.push(node);
    }
    state.set(ref, "done");
    return true;
  };

  for (const ref of nodes.keys()) {
    if (!visit(ref)) return { order: [], cycle };
  }
  return { order, cycle: [] };
}
