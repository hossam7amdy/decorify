# Design: Remove `inject` Array from `FactoryProvider`

**Date:** 2026-04-09
**Package:** `@decorify/di`
**Type:** Breaking change (major version bump)

## Summary

Remove the `inject?` array and `OptionalFactoryDependency` type from `FactoryProvider`. Factories must use `inject()` directly inside the factory function. The `useFactory` signature is narrowed from `(...args: any[]) => T | Promise<T>` to `() => T | Promise<T>`.

## Motivation

The `inject` array is redundant. `inject()` already works inside factory functions because the injection context is active during factory execution. Having two mechanisms for the same thing increases API surface, adds cognitive load, and requires extra implementation complexity (`buildFactoryInstance`, `buildFactoryInstanceAsync`, `isOptionalFactoryDependency`). Removing the array leaves a single, consistent way to declare factory dependencies.

Optional factory dependencies (`{ token: X, optional: true }`) are dropped without replacement. Optional dep support will be added as a separate, container-level feature in a future release.

## Changes

### 1. Types (`packages/di/src/types.ts`)

Remove `inject?` and `OptionalFactoryDependency`. Narrow `useFactory` to no-arg:

```ts
// Before
export type OptionalFactoryDependency<T = any> = {
  token: Token<T>;
  optional: boolean;
};

export interface FactoryProvider<T = any> {
  provide: Token;
  useFactory: (...args: any[]) => T | Promise<T>;
  inject?: Array<Token | OptionalFactoryDependency>;
  lifetime?: Lifetime;
}

// After
export interface FactoryProvider<T = any> {
  provide: Token;
  useFactory: () => T | Promise<T>;
  lifetime?: Lifetime;
}
```

`OptionalFactoryDependency` is deleted entirely — from the type definition and from the barrel export in `index.ts`.

### 2. Container (`packages/di/src/container.ts`)

`buildFactoryInstance` and `buildFactoryInstanceAsync` collapse to direct calls:

```ts
// Before
private buildFactoryInstance<T>(provider: FactoryProvider<T>): T {
  const deps = provider.inject ?? [];
  const args: unknown[] = [];
  for (const dep of deps) {
    if (isOptionalFactoryDependency(dep)) {
      if (dep.optional && !this.has(dep.token)) args.push(undefined);
      else args.push(this.resolveInContext(dep.token));
    } else {
      args.push(this.resolveInContext(dep as Token));
    }
  }
  const result = provider.useFactory(...args);
  if (result instanceof Promise) throw new AsyncFactoryError(provider.provide);
  return result as T;
}

// After
private buildFactoryInstance<T>(provider: FactoryProvider<T>): T {
  const result = provider.useFactory();
  if (result instanceof Promise) throw new AsyncFactoryError(provider.provide);
  return result as T;
}
```

```ts
// Before
private async buildFactoryInstanceAsync<T>(p: FactoryProvider<T>): Promise<T> {
  const deps = p.inject ?? [];
  const args: unknown[] = [];
  for (const dep of deps) { ... }
  return await p.useFactory(...args);
}

// After
private async buildFactoryInstanceAsync<T>(p: FactoryProvider<T>): Promise<T> {
  return await p.useFactory();
}
```

Remove `isOptionalFactoryDependency` from the import list in `container.ts`.

### 3. Utils (`packages/di/src/utils.ts`)

Delete `isOptionalFactoryDependency` function entirely.

### 4. Tests (`packages/di/src/container.test.ts`)

- Rewrite all tests that used the `inject` array to use `inject()` inside the factory instead.
- Delete all test cases that tested optional factory dependencies (`{ token: X, optional: true }`).

Before/after migration pattern:

```ts
// Before
{ provide: RESULT, useFactory: (a, b) => `${a}-${b}`, inject: [A, B] }

// After
{ provide: RESULT, useFactory: () => `${inject(A)}-${inject(B)}` }
```

### 5. Documentation

**`packages/di/README.md`:**

- Remove the two factory examples that show the `inject` array (required deps, optional dep).
- Replace with `inject()`-inside-factory examples.
- Remove `OptionalFactoryDependency` from the Types section import block.

**`README.md` (root):**

- Verify no `inject` array examples remain (the root README already avoids them).

**`CLAUDE.md`:**

- Remove `OptionalFactoryDependency` from the `types.ts` listed exports.
- Update the DI architecture description to remove mention of the `inject` array on `FactoryProvider`.

## Migration Guide (for users)

```ts
// Before
container.register({
  provide: LOGGER,
  useFactory: (config: AppConfig) => new Logger({ level: config.logLevel }),
  inject: [APP_CONFIG],
});

// After
container.register({
  provide: LOGGER,
  useFactory: () => new Logger({ level: inject(APP_CONFIG).logLevel }),
});
```

Optional dependencies used with `{ token: X, optional: true }` have no direct replacement in this release. Use a try/catch around `inject()` or restructure to avoid optional deps until the feature is added at the container level.

## Out of Scope

- `injectOptional()` helper — future work
- Container-level optional dependency API — future work
- Any changes to `@Inject` decorator, `ClassProvider`, `ValueProvider`, or `ExistingProvider`
