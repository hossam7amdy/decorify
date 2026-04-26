import { suite, it } from "node:test";
import assert from "node:assert/strict";
import { runAdapterConformance } from "../src/index.ts";
import type { ConformanceTestRunner } from "../src/index.ts";
import { NodeHttpAdapter } from "./__fixtures__/node-http-adapter.ts";

const describe: ConformanceTestRunner["describe"] = (label, fn) => {
  suite(label, { concurrency: true, timeout: 2000 }, fn);
};

const expect: ConformanceTestRunner["expect"] = (actual: any) => ({
  toBe: function (expected: unknown): void {
    assert.strictEqual(actual, expected);
  },
  toEqual: function (expected: unknown): void {
    assert.deepStrictEqual(actual, expected);
  },
  toContain: function (expected: unknown): void {
    assert.ok(actual.includes(expected));
  },
  toMatch: function (pattern: RegExp | string): void {
    if (typeof pattern === "string") {
      assert.ok(String(actual).includes(pattern));
    } else {
      assert.match(String(actual), pattern);
    }
  },
  toBeGreaterThanOrEqual: function (n: number): void {
    assert.ok(actual >= n);
  },
  toBeLessThan: function (n: number): void {
    assert.ok(actual < n);
  },
  toBeDefined: function (): void {
    assert.notStrictEqual(actual, undefined);
  },
  toBeUndefined: function (): void {
    assert.strictEqual(actual, undefined);
  },
  not: {
    toBeNull: function (): void {
      assert.notStrictEqual(actual, null);
    },
  },
  rejects: {
    toThrow: async function (): Promise<void> {
      await assert.rejects(async () =>
        typeof actual === "function" ? await actual() : await actual,
      );
    },
  },
});

runAdapterConformance({
  name: NodeHttpAdapter.name,
  makeAdapter: () => new NodeHttpAdapter(),
  runner: { describe, it, expect },
});
