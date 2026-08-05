import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Constructor } from "injectus";

import { type ModuleNode, topoSort } from "./graph.ts";

function node(ref: Constructor, imports: Constructor[]): ModuleNode {
  return {
    ref,
    imports,
    providers: [],
    controllers: [],
    exports: [],
    dynamic: false,
  };
}

class A {}
class B {}
class C {}
class D {}

function refs(result: { order: readonly ModuleNode[] }): Constructor[] {
  return result.order.map((entry) => entry.ref);
}

describe("topoSort", { timeout: 1000, concurrency: true }, () => {
  it("returns an empty result for an empty graph", () => {
    const result = topoSort(new Map());

    assert.deepEqual(result.order, []);
    assert.deepEqual(result.cycle, []);
  });

  it("orders a single node", () => {
    assert.deepEqual(refs(topoSort(new Map([[A, node(A, [])]]))), [A]);
  });

  it("places imports before importers", () => {
    const nodes = new Map([
      [A, node(A, [B])],
      [B, node(B, [C])],
      [C, node(C, [])],
    ]);

    assert.deepEqual(refs(topoSort(nodes)), [C, B, A]);
  });

  it("visits a shared import once", () => {
    const nodes = new Map([
      [A, node(A, [B, C])],
      [B, node(B, [D])],
      [C, node(C, [D])],
      [D, node(D, [])],
    ]);

    assert.deepEqual(refs(topoSort(nodes)), [D, B, C, A]);
  });

  it("orders disconnected components", () => {
    const nodes = new Map([
      [A, node(A, [])],
      [B, node(B, [])],
    ]);

    assert.deepEqual(refs(topoSort(nodes)), [A, B]);
  });

  it("reports a cycle and returns no order", () => {
    const nodes = new Map([
      [A, node(A, [B])],
      [B, node(B, [A])],
    ]);
    const result = topoSort(nodes);

    assert.deepEqual(result.order, []);
    assert.deepEqual(result.cycle, [A, B, A]);
  });

  it("reports a self-cycle", () => {
    assert.deepEqual(topoSort(new Map([[A, node(A, [A])]])).cycle, [A, A]);
  });

  it("skips imports of modules absent from the map", () => {
    const result = topoSort(new Map([[A, node(A, [B])]]));

    assert.deepEqual(refs(result), [A]);
    assert.deepEqual(result.cycle, []);
  });
});
