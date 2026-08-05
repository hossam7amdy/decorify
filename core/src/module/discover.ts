import type { Constructor } from "injectus";

import type {
  DynamicModule,
  ModuleEntry,
  ModuleMetadata,
} from "../interfaces/module.interface.ts";
import { readModuleMetadata } from "../metadata/module.metadata.ts";
import { getProviderToken } from "./deps.ts";
import type { DecorifyError } from "./errors.ts";
import { type ModuleGraph, type ModuleNode, topoSort } from "./graph.ts";

interface Resolved {
  ref: Constructor;
  meta: ModuleMetadata;
  dynamic: boolean;
}

/**
 * Walk the module graph breadth-first from `root`, awaiting dynamic modules.
 *
 * Modules dedupe by class reference: one class is one node, however many
 * modules import it. A `DynamicModule` supplies that node's metadata; a bare
 * class import of the same module contributes only the edge. Discovery never
 * throws: problems are collected into `graph.issues` for `validate` to report
 * alongside its own.
 */
export async function discover(entry: ModuleEntry): Promise<ModuleGraph> {
  const root = await entry;
  const nodes = new Map<Constructor, ModuleNode>();
  const issues: DecorifyError[] = [];
  const queue: ModuleEntry[] = [root];

  while (queue.length > 0) {
    const entry = queue.shift() as ModuleEntry;
    const { ref, meta, dynamic } = await resolveEntry(entry);
    const importEntries = meta.imports ?? [];
    const imports = await Promise.all(importEntries.map(resolveEntry));

    const node: ModuleNode = {
      ref,
      dynamic,
      imports: imports.map((resolved) => resolved.ref),
      providers: [...(meta.providers ?? [])],
      controllers: [...(meta.controllers ?? [])],
      exports: [...(meta.exports ?? [])],
    };

    const existing = nodes.get(ref);
    if (existing) {
      // A bare class import is an edge, not a configuration: `imports: [Foo]`
      // says "I depend on Foo", and whichever import called `Foo.forRoot()`
      // says what Foo provides.
      if (!dynamic) continue;

      if (!existing.dynamic) {
        nodes.set(ref, node);
        queue.push(...importEntries);
        continue;
      }

      if (!sameTokens(existing, node)) {
        issues.push({
          code: "DECORIFY_E_DYNAMIC_CONFLICT",
          module: ref.name,
          message: `${ref.name} was configured more than once with different providers. decorify runs one injector, which cannot hold two configurations of the same module — call the configuring method once and import ${ref.name} directly everywhere else.`,
        });
      }
      continue;
    }

    nodes.set(ref, node);
    queue.push(...importEntries);
  }

  const { order, cycle } = topoSort(nodes);
  if (cycle.length > 0) {
    const path = cycle.map((ref) => ref.name);
    issues.push({
      code: "DECORIFY_E_MODULE_CYCLE",
      message: `Module import cycle: ${path.join(" -> ")}. decorify has no forwardRef — break the cycle by extracting the shared providers into a third module.`,
      path,
    });
  }

  return { root, nodes, order, issues };
}

async function resolveEntry(entry: ModuleEntry): Promise<Resolved> {
  const value = await entry;
  if (typeof value === "function") {
    return {
      ref: value,
      meta: staticMeta(value),
      dynamic: false,
    };
  }
  return {
    ref: value.module,
    meta: merge(staticMeta(value.module), value),
    dynamic: true,
  };
}

function staticMeta(ref: Constructor): ModuleMetadata {
  return readModuleMetadata(ref) ?? {};
}

function merge(base: ModuleMetadata, dynamic: DynamicModule): ModuleMetadata {
  return {
    imports: [...(base.imports ?? []), ...(dynamic.imports ?? [])],
    providers: [...(base.providers ?? []), ...(dynamic.providers ?? [])],
    controllers: [...(base.controllers ?? []), ...(dynamic.controllers ?? [])],
    exports: [...(base.exports ?? []), ...(dynamic.exports ?? [])],
  };
}

function sameTokens(a: ModuleNode, b: ModuleNode): boolean {
  if (a.providers.length !== b.providers.length) return false;
  const tokens = new Set(a.providers.map(getProviderToken));
  return b.providers.every((provider) =>
    tokens.has(getProviderToken(provider)),
  );
}
