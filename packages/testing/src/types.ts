/** Subset of vitest/jest `expect(actual)` return value used by the conformance suite. */
export interface ConformanceAssertions {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(expected: unknown): void;
  toMatch(pattern: RegExp | string): void;
  toBeGreaterThanOrEqual(n: number): void;
  toBeLessThan(n: number): void;
  toBeDefined(): void;
  toBeUndefined(): void;
  not: { toBeNull(): void };
  rejects: { toThrow(): Promise<void> };
}

/**
 * Minimal test-runner API consumed by the conformance suite.
 * Both vitest and Jest satisfy this interface structurally.
 *
 * @example Vitest
 * ```ts
 * import { describe, it, expect } from "vitest";
 * runAdapterConformance({ ..., runner: { describe, it, expect } });
 * ```
 *
 * @example Jest
 * ```ts
 * import { describe, it, expect } from "@jest/globals";
 * runAdapterConformance({ ..., runner: { describe, it, expect } });
 * ```
 */
export interface ConformanceTestRunner {
  describe(label: string, fn: () => void): void;
  it(label: string, fn: () => Promise<void> | void): void;
  expect(actual: unknown): ConformanceAssertions;
}

export interface AdapterConformanceOptions<TAdapter> {
  name: string;
  /** May be async — useful for frameworks that require async initialization. */
  makeAdapter: () => TAdapter | Promise<TAdapter>;
  /** Host to bind to and use in request URLs. Default: `"127.0.0.1"`. */
  host?: string;
  /**
   * Maximum JSON payload the adapter accepts, in bytes.
   * Default: `100_000` (100 kb).
   * Used by the oversized-body test — payload is set to `2 × bodyLimit`.
   */
  bodyLimit?: number;
  /**
   * Test runner functions. Pass `{ describe, it, expect }` from your test framework.
   * Both vitest and Jest satisfy this interface.
   */
  runner: ConformanceTestRunner;
}
