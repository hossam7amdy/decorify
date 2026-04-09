# `injectAsync()` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `injectAsync()` to fix two regressions from the inject-array removal: async singleton deps now work without pre-priming, and transient async providers can be used inside factory functions.

**Architecture:** Extend the internal `Resolver` interface with `resolveInContextAsync`, add a new `InjectionContextError` class (replacing the plain `Error` in `inject()`), then add `injectAsync()` as an async companion to `inject()`. All three changes touch `context.ts` and `errors.ts` only — `container.ts` already implements `resolveInContextAsync`.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces (`@decorify/di`), `node:async_hooks` AsyncLocalStorage

---

## File Map

| File                                 | Change                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| `packages/di/src/errors.ts`          | Add `InjectionContextError` class                                                     |
| `packages/di/src/context.ts`         | Extend `Resolver`; fix `inject()` to use `InjectionContextError`; add `injectAsync()` |
| `packages/di/src/index.ts`           | Export `injectAsync` and `InjectionContextError`                                      |
| `packages/di/src/decorators.test.ts` | Update out-of-context test to assert `InjectionContextError`                          |
| `packages/di/src/container.test.ts`  | Add `injectAsync()` describe block (3 tests)                                          |
| `packages/di/README.md`              | Add `injectAsync()` subsection; update Types import block                             |

---

## Task 1: Add `InjectionContextError`; fix `inject()` error type

**Files:**

- Modify: `packages/di/src/errors.ts`
- Modify: `packages/di/src/context.ts`
- Modify: `packages/di/src/index.ts`
- Modify: `packages/di/src/decorators.test.ts`

- [ ] **Step 1: Update the existing out-of-context test to assert `InjectionContextError`**

Open `packages/di/src/decorators.test.ts`. The test at line 42 currently does a string match. Replace it so it asserts the class:

```ts
// Add InjectionContextError to the import at line 3:
import { Container } from "./container.js";
import { Injectable, Inject, inject } from "./decorators.js";
import { InjectionContextError } from "./errors.js";

// Replace the test body (line 42-47):
it("inject() should throw if called outside injection context", () => {
  class Dep {}
  expect(() => inject(Dep)).toThrow(InjectionContextError);
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
pnpm --filter @decorify/di exec vitest run src/decorators.test.ts
```

Expected: FAIL — `inject()` currently throws a plain `Error`, not an `InjectionContextError` instance.

- [ ] **Step 3: Add `InjectionContextError` to `errors.ts`**

Open `packages/di/src/errors.ts`. Append at the end of the file (after `AsyncFactoryError`):

```ts
export class InjectionContextError extends DIError {
  constructor(fn: "inject" | "injectAsync") {
    super(
      `${fn}() called outside of an injection context. ` +
        `It can only be used inside a class constructor or factory function ` +
        `that is being resolved by the DI container.`,
    );
  }
}
```

- [ ] **Step 4: Fix `inject()` in `context.ts` to use `InjectionContextError`**

Open `packages/di/src/context.ts`. Add the import and replace the throw in `inject()`:

```ts
import { AsyncLocalStorage } from "node:async_hooks";
import type { Token } from "./types.js";
import type { Lifetime } from "./lifetime.js";
import { InjectionContextError } from "./errors.js";

// ... (Resolver, InjectionContext, injectionContext unchanged) ...

export function inject<T>(token: Token<T>): T {
  const ctx = injectionContext.getStore();
  if (!ctx) throw new InjectionContextError("inject");
  return ctx.container.resolveInContext(token);
}
```

- [ ] **Step 5: Export `InjectionContextError` from `index.ts`**

Open `packages/di/src/index.ts`. Add `InjectionContextError` to the errors export:

```ts
export {
  DIError,
  DISuppressedError,
  MissingStrategyError,
  DuplicateTokenError,
  ContainerDisposedError,
  NoProviderError,
  ScopedResolutionError,
  CircularDependencyError,
  CaptiveDependencyError,
  AsyncFactoryError,
  InjectionContextError,
} from "./errors.js";
```

- [ ] **Step 6: Run all DI tests**

```bash
pnpm --filter @decorify/di exec vitest run src/decorators.test.ts
```

Expected: all tests pass.

```bash
pnpm --filter @decorify/di build
```

Expected: clean build — no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/di/src/errors.ts packages/di/src/context.ts packages/di/src/index.ts packages/di/src/decorators.test.ts
git commit -m "feat(di): add InjectionContextError; fix inject() to throw DIError subclass"
```

---

## Task 2: Add `injectAsync()`

**Files:**

- Modify: `packages/di/src/container.test.ts`
- Modify: `packages/di/src/context.ts`
- Modify: `packages/di/src/index.ts`

- [ ] **Step 1: Add failing tests for `injectAsync()`**

Open `packages/di/src/container.test.ts`. At the top, add `injectAsync` to the context import:

```ts
import { inject, injectAsync } from "./context.js";
```

At the end of the file (before the final closing `}`), add a new describe block:

```ts
describe("injectAsync()", () => {
  it("should resolve an async singleton dep without pre-priming", async () => {
    const DB = new InjectionToken<string>("db");
    const REPO = new InjectionToken<string>("repo");

    container.register({ provide: DB, useFactory: async () => "db-instance" });
    container.register({
      provide: REPO,
      useFactory: async () => `repo(${await injectAsync(DB)})`,
    });

    expect(await container.resolveAsync(REPO)).toBe("repo(db-instance)");
  });

  it("should resolve a transient async dep (never cached) inside a factory", async () => {
    const DEP = new InjectionToken<number>("dep");
    const RESULT = new InjectionToken<number>("result");
    let calls = 0;

    container.register({
      provide: DEP,
      useFactory: async () => ++calls,
      lifetime: Lifetime.TRANSIENT,
    });
    container.register({
      provide: RESULT,
      useFactory: async () => await injectAsync(DEP),
    });

    const a = await container.resolveAsync(RESULT);
    expect(a).toBe(1);
    expect(calls).toBe(1);
  });

  it("should throw InjectionContextError when called outside of an injection context", async () => {
    await expect(injectAsync(new InjectionToken("tok"))).rejects.toThrow(
      InjectionContextError,
    );
  });
});
```

Also add `InjectionContextError` to the imports at the top of the file:

```ts
import { InjectionContextError } from "./errors.js";
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm --filter @decorify/di exec vitest run src/container.test.ts
```

Expected: FAIL — `injectAsync is not a function` (or similar TypeScript/runtime error).

- [ ] **Step 3: Extend `Resolver` and add `injectAsync()` to `context.ts`**

Open `packages/di/src/context.ts`. Make two changes:

**Extend `Resolver`:**

```ts
export interface Resolver {
  resolveInContext<T>(token: Token<T>): T;
  resolveInContextAsync<T>(token: Token<T>): Promise<T>;
}
```

**Add `injectAsync()` after `inject()`:**

```ts
/**
 * Asynchronously resolve a dependency from the current injection context.
 * Must be awaited. Can only be called inside an async factory function
 * that is being resolved by the DI container.
 * Works for async singletons (without pre-priming) and transient async providers.
 *
 * @example
 * container.register({
 *   provide: USER_REPO,
 *   useFactory: async () => new UserRepository(await injectAsync(DATABASE)),
 * });
 */
export async function injectAsync<T>(token: Token<T>): Promise<T> {
  const ctx = injectionContext.getStore();
  if (!ctx) throw new InjectionContextError("injectAsync");
  return ctx.container.resolveInContextAsync(token);
}
```

- [ ] **Step 4: Export `injectAsync` from `index.ts`**

Open `packages/di/src/index.ts`. Update the context export line:

```ts
export {
  inject,
  injectAsync,
  injectionContext as _injectionContext,
} from "./context.js";
```

- [ ] **Step 5: Run all tests**

```bash
pnpm --filter @decorify/di exec vitest run src/container.test.ts
```

Expected: all tests pass including the 3 new `injectAsync()` tests.

```bash
pnpm --filter @decorify/di build
```

Expected: clean build — no TypeScript errors. (Container already implements `resolveInContextAsync`, so extending `Resolver` causes no new errors.)

- [ ] **Step 6: Run full workspace test suite**

```bash
pnpm test
```

Expected: all tests across all packages pass.

- [ ] **Step 7: Commit**

```bash
git add packages/di/src/context.ts packages/di/src/index.ts packages/di/src/container.test.ts
git commit -m "feat(di): add injectAsync() for async factory dependency resolution"
```

---

## Task 3: Update `packages/di/README.md`

**Files:**

- Modify: `packages/di/README.md`

- [ ] **Step 1: Add `injectAsync()` subsection**

After the existing `### \`inject()\` — functional injection` section, insert a new subsection:

````md
### `injectAsync()` — async functional injection

Resolves a dependency asynchronously. Use this inside `async` factory functions when the dependency has an async factory or is a transient provider. Cannot be used in class constructors.

```ts
import { injectAsync } from "@decorify/di";

// Async singleton dep — no pre-priming required
container.register({
  provide: USER_REPO,
  useFactory: async () => new UserRepository(await injectAsync(DATABASE)),
});

// Transient async dep — fresh instance per resolution
container.register({
  provide: REQUEST_HANDLER,
  useFactory: async () => new Handler(await injectAsync(TRANSIENT_LOGGER)),
});
```
````

- [ ] **Step 2: Add `injectAsync` to the Types section**

In the `## Types` section, the value imports line currently reads:

```ts
import { InjectionToken, Lifetime, Container } from "@decorify/di";
```

Update to:

```ts
import {
  InjectionToken,
  Lifetime,
  Container,
  inject,
  injectAsync,
} from "@decorify/di";
```

Also add `InjectionContextError` to the type imports block if it lists error classes.

- [ ] **Step 3: Commit**

```bash
git add packages/di/README.md
git commit -m "docs(di): add injectAsync() documentation"
```
