# Design: `injectAsync()` — Async Functional Injection

**Date:** 2026-04-09
**Package:** `@decorify/di`
**Type:** Additive (non-breaking)

## Motivation

Removing the `inject` array from `FactoryProvider` introduced two regressions:

1. **Async singletons require manual pre-priming.** `inject()` is synchronous — it calls `resolveInContext()` which throws `AsyncFactoryError` if the token's factory returns a `Promise` and the instance isn't already cached. Users must manually call `resolveAsync(token)` before any factory that depends on it.

2. **Transient async providers are completely broken as factory deps.** Transient instances are never cached by definition, so there is no pre-priming strategy. A factory that needs a fresh instance of an async transient cannot get one via `inject()`.

`injectAsync()` fixes both regressions without restoring the inject array.

## Approach

Extend the `Resolver` interface to expose `resolveInContextAsync`. Add `injectAsync()` as an async companion to `inject()` that calls the async resolution path from within the active injection context.

`Resolver` is not exported publicly (it is `@internal`), so extending it is not a breaking change.

## Changes

### 1. `packages/di/src/context.ts`

Extend `Resolver` and add `injectAsync()`:

```ts
export interface Resolver {
  resolveInContext<T>(token: Token<T>): T;
  resolveInContextAsync<T>(token: Token<T>): Promise<T>; // NEW
}

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
  if (!ctx) {
    throw new Error(
      `injectAsync() called outside of an injection context. ` +
        `It can only be used inside an async factory function ` +
        `that is being resolved by the DI container.`,
    );
  }
  return ctx.container.resolveInContextAsync(token);
}
```

`Container` already implements `resolveInContextAsync` as a public method — no changes to `container.ts`.

### 2. `packages/di/src/index.ts`

Export `injectAsync` alongside `inject`:

```ts
export {
  inject,
  injectAsync,
  injectionContext as _injectionContext,
} from "./context.js";
```

### 3. Tests (`packages/di/src/container.test.ts`)

New `"injectAsync()"` describe block with three cases:

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

  it("should throw when called outside of an injection context", async () => {
    const TOKEN = new InjectionToken<string>("tok");
    container.register({ provide: TOKEN, useValue: "v" });

    await expect(injectAsync(TOKEN)).rejects.toThrow(
      "injectAsync() called outside of an injection context",
    );
  });
});
```

### 4. `packages/di/README.md`

Add `injectAsync()` subsection after the existing `inject()` section:

````md
### `injectAsync()` — async functional injection

Resolves a dependency asynchronously. Use this inside `async` factory functions when the
dependency has an async factory or is transient. Cannot be used in class constructors.

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

Add `injectAsync` to the value imports in the Types section:

```ts
import {
  InjectionToken,
  Lifetime,
  Container,
  inject,
  injectAsync,
} from "@decorify/di";
```

## Constraints

- `injectAsync()` is only valid inside `async` factory functions — class constructors cannot be `async` and therefore cannot use it.
- `injectAsync()` is context-aware: it uses the same `AsyncLocalStorage` injection context as `inject()`, so captive dependency and circular dependency detection still apply.
- No changes to `container.ts` are required — `Container` already implements `resolveInContextAsync`.

## Out of Scope

- `injectOptional()` / `injectAsyncOptional()` — future work
- Using `injectAsync()` outside of factory functions (class constructors, field initializers)
