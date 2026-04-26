# Implementation Plan: Decouple Conformance Suite from Vitest

## Overview

`packages/core/src/testing/adapter-conformance.ts` currently hard-imports `{ describe, it, expect }` from `"vitest"`. That means any project using a different test runner (Jest, Mocha, Jasmine) cannot import `@decorify/core/testing` without vitest installed — even though `vitest` is already declared as an **optional** peer dependency in `package.json`.

The fix: remove the direct vitest import from `adapter-conformance.ts`, define a minimal `ConformanceTestRunner` interface, and require callers to pass their own `runner: { describe, it, expect }`. The two existing call sites (both vitest test files) each add one import line and one field. No behavior changes.

## Architecture Decisions

### Inject runner, don't default to vitest

Defaulting to vitest via a dynamic `await import("vitest")` would keep the ergonomics but requires async init, complicates type inference, and defeats the point. Requiring the runner is a small breaking change that produces a cleaner, statically typed, zero-magic API.

### Minimal interface, not type-aliased from vitest

Define `ConformanceTestRunner` and `ConformanceAssertions` locally inside `adapter-conformance.ts`. Keeps the conformance module free of any vitest type imports. Both vitest and Jest satisfy the interface structurally.

### No new package.json subpath export needed

A vitest-specific subpath (`@decorify/core/testing/vitest`) would be handy but adds maintenance surface. Since both existing call sites already run inside vitest, they can simply pass the imported vitest functions directly. A convenience wrapper can be added later if demand exists.

### Keep `testing/index.ts` clean of vitest

`testing/index.ts` will only re-export from `adapter-conformance.ts`. No vitest import anywhere in the published module tree.

## Task List

### Phase 1: Define interface and decouple core module

- [ ] **Task 1:** Define `ConformanceTestRunner` interface; make `runner` required in options; remove vitest import

### Checkpoint: Phase 1

- [ ] `adapter-conformance.ts` has no `vitest` import (grep confirms)
- [ ] `pnpm --filter @decorify/core build` passes (TS catches missing fields)
- [ ] Core and Express tests still pass

---

### Phase 2: Update call sites

- [ ] **Task 2:** Update `node-http-adapter.test.ts` to pass vitest runner
- [ ] **Task 3:** Update `packages/adapters/express/test/adapter-conformance.test.ts` to pass vitest runner

### Checkpoint: Phase 2

- [ ] `pnpm test` (root) → all 232 tests pass
- [ ] `pnpm build` clean

---

### Phase 3: Documentation

- [ ] **Task 4:** Update `packages/core/src/testing/README.md` to show runner injection in Quick Start example and Options table
- [ ] **Task 5:** Update `testing/index.ts` to export `ConformanceTestRunner` type

### Checkpoint: Phase 3 (Complete)

- [ ] README Quick Start compiles without vitest import
- [ ] `ConformanceTestRunner` exported from `@decorify/core/testing`
- [ ] All 232 tests pass, build clean

---

## Interface Design

```ts
/** Subset of vitest/jest `expect(x)` result used by the conformance suite. */
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

/** Minimal test-runner API the conformance suite needs. */
export interface ConformanceTestRunner {
  describe(label: string, fn: () => void): void;
  it(label: string, fn: () => Promise<void> | void): void;
  expect(actual: unknown): ConformanceAssertions;
}
```

Updated call site pattern (vitest):

```ts
import { describe, it, expect } from "vitest";
import { runAdapterConformance } from "@decorify/core/testing";

runAdapterConformance({
  name: MyAdapter.name,
  makeAdapter: () => new MyAdapter(),
  runner: { describe, it, expect },
});
```

## Files Touched

| File                                                         | Change                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `packages/core/src/testing/adapter-conformance.ts`           | Remove vitest import; add `ConformanceTestRunner` interface; require `runner` in options |
| `packages/core/src/testing/index.ts`                         | Re-export `ConformanceTestRunner` type                                                   |
| `packages/core/src/testing/node-http-adapter.test.ts`        | Pass `runner: { describe, it, expect }`                                                  |
| `packages/adapters/express/test/adapter-conformance.test.ts` | Pass `runner: { describe, it, expect }`                                                  |
| `packages/core/src/testing/README.md`                        | Update Quick Start and Options table                                                     |

## Risks and Mitigations

| Risk                                                                              | Impact | Mitigation                                                           |
| --------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| Breaking change — `runner` now required                                           | Low    | Only two call sites, both in-repo; update in same PR                 |
| `ConformanceAssertions.rejects.toThrow()` type doesn't satisfy Jest's return type | Low    | Both Jest and vitest return `Promise<void>` for `.rejects.toThrow()` |
| Future test runner uses different `expect` shape                                  | Low    | Interface covers only what the suite actually uses; easy to extend   |

## Out of Scope

- Convenience vitest wrapper (`runVitestAdapterConformance`) — callers can do it themselves trivially
- Jest integration test — no Jest in this repo; left as documentation only
- Mocha / tap support — same; document in README
