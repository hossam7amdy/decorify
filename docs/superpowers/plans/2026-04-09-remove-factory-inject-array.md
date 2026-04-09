# Remove Factory `inject` Array Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the `inject` array and `OptionalFactoryDependency` type from `FactoryProvider`, locking `useFactory` to a strict no-arg signature so all dependency resolution happens via `inject()` inside the factory.

**Architecture:** Tests are updated first (they continue to pass since `inject()` already works in factory context), then the types and implementation are simplified, then docs are updated. This is a clean break — no deprecation shim.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces (`@decorify/di`)

---

## File Map

| File                                | Change                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `packages/di/src/container.test.ts` | Rewrite 2 inject-array tests; delete 3 optional-dep tests                                                           |
| `packages/di/src/types.ts`          | Remove `OptionalFactoryDependency`, narrow `useFactory` to `() => T \| Promise<T>`, remove `inject?` field          |
| `packages/di/src/container.ts`      | Simplify `buildFactoryInstance` + `buildFactoryInstanceAsync`; remove `isOptionalFactoryDependency` import          |
| `packages/di/src/utils.ts`          | Delete `isOptionalFactoryDependency` function                                                                       |
| `packages/di/src/index.ts`          | Remove `OptionalFactoryDependency` from barrel export                                                               |
| `packages/di/README.md`             | Replace inject-array examples with `inject()`-inside-factory; remove `OptionalFactoryDependency` from Types section |
| `CLAUDE.md`                         | Remove `OptionalFactoryDependency` from types.ts description; update DI architecture note                           |

---

## Task 1: Rewrite inject-array tests; delete optional-dep tests

**Files:**

- Modify: `packages/di/src/container.test.ts:562-633`

These are the 5 test cases in the `"factory provider"` describe block that use the `inject` array. The `inject()` function already works inside factories (context is active), so after the rewrite these tests pass without touching the implementation.

- [ ] **Step 1: Rewrite "should pass resolved inject tokens as factory arguments"** (line 562)

Replace the entire test with:

```ts
it("should resolve deps using inject() inside factory", () => {
  const A = new InjectionToken<string>("a");
  const B = new InjectionToken<number>("b");
  const RESULT = new InjectionToken<string>("result");

  container.register({ provide: A, useValue: "hello" });
  container.register({ provide: B, useValue: 42 });
  container.register({
    provide: RESULT,
    useFactory: () => `${inject(A)}-${inject(B)}`,
  });

  expect(container.resolve(RESULT)).toBe("hello-42");
});
```

- [ ] **Step 2: Rewrite "should throw for missing non-optional inject token"** (line 605)

Replace with:

```ts
it("should throw when inject() inside factory targets unregistered token", () => {
  const MISSING = new InjectionToken<string>("missing");
  const TOKEN = new InjectionToken<string>("result");

  container.register({
    provide: TOKEN,
    useFactory: () => inject(MISSING),
  });

  expect(() => container.resolve(TOKEN)).toThrow(
    "No provider registered for InjectionToken(missing)",
  );
});
```

- [ ] **Step 3: Delete the three optional-dep tests**

Delete these three complete `it(...)` blocks:

- `"should resolve OptionalFactoryDependency when token is registered"` (line 578–590)
- `"should pass undefined for optional dependency when token is not registered"` (line 592–603)
- `"should handle mix of plain tokens and optional dependencies"` (line 620–633)

- [ ] **Step 4: Run the tests — expect all to pass**

```bash
pnpm --filter @decorify/di exec vitest run src/container.test.ts
```

Expected: all tests pass. If any fail, the `inject()` context is not being set up correctly during factory execution — check that `buildFactoryInstance` calls `useFactory()` inside a valid injection context (it does, since it is called from within `resolveInContext`).

- [ ] **Step 5: Commit**

```bash
git add packages/di/src/container.test.ts
git commit -m "test(di): rewrite inject-array tests to use inject() inside factory; remove optional-dep tests"
```

---

## Task 2: Remove `OptionalFactoryDependency` and narrow `FactoryProvider` type

**Files:**

- Modify: `packages/di/src/types.ts`

- [ ] **Step 1: Delete `OptionalFactoryDependency` and update `FactoryProvider`**

Open `packages/di/src/types.ts`. Replace the current content with:

```ts
import type { Lifetime } from "./lifetime.js";
import type { InjectionToken } from "./injection-token.js";

export type Constructor<T = any> = new (...args: any[]) => T;

export type Token<T = any> = Constructor<T> | InjectionToken<T>;

export type Provider<T = any> =
  | Constructor<T>
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;

export interface ClassProvider<T = any> {
  provide: Token;
  useClass: Constructor<T>;
  lifetime?: Lifetime;
}

export interface ValueProvider<T = any> {
  provide: Token;
  useValue: T;
}

export interface FactoryProvider<T = any> {
  provide: Token;
  useFactory: () => T | Promise<T>;
  lifetime?: Lifetime;
}

export interface ExistingProvider<T = any> {
  provide: Token;
  useExisting: Token<T>;
}
```

- [ ] **Step 2: Run build to check for TypeScript errors**

```bash
pnpm --filter @decorify/di build
```

Expected: build succeeds. If TypeScript complains about `isOptionalFactoryDependency` or references to `OptionalFactoryDependency`, that's expected — they'll be fixed in Tasks 3 and 4.

- [ ] **Step 3: Commit**

```bash
git add packages/di/src/types.ts
git commit -m "feat(di)!: remove OptionalFactoryDependency; narrow FactoryProvider.useFactory to no-arg"
```

---

## Task 3: Simplify `container.ts` — remove inject-array resolution logic

**Files:**

- Modify: `packages/di/src/container.ts`

- [ ] **Step 1: Remove `isOptionalFactoryDependency` from the import**

At the top of `container.ts`, the import block from `"./utils.js"` currently includes `isOptionalFactoryDependency`. Remove only that name:

```ts
import {
  hasStrategy,
  isClassProvider,
  isConstructorProvider,
  isExistingProvider,
  isFactoryProvider,
  isValueProvider,
  tokenName,
} from "./utils.js";
```

- [ ] **Step 2: Replace `buildFactoryInstance`**

Find the `buildFactoryInstance` private method (currently ~line 279) and replace its entire body:

```ts
private buildFactoryInstance<T>(provider: FactoryProvider<T>): T {
  const result = provider.useFactory();
  if (result instanceof Promise) {
    throw new AsyncFactoryError(provider.provide);
  }
  return result as T;
}
```

- [ ] **Step 3: Replace `buildFactoryInstanceAsync`**

Find the `buildFactoryInstanceAsync` private method and replace its entire body:

```ts
private async buildFactoryInstanceAsync<T>(
  p: FactoryProvider<T>,
): Promise<T> {
  return await p.useFactory();
}
```

- [ ] **Step 4: Run the full test suite**

```bash
pnpm --filter @decorify/di exec vitest run src/container.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/di/src/container.ts
git commit -m "refactor(di): simplify buildFactoryInstance — no-arg factory, remove inject-array resolution"
```

---

## Task 4: Delete `isOptionalFactoryDependency` from `utils.ts` and update `index.ts`

**Files:**

- Modify: `packages/di/src/utils.ts`
- Modify: `packages/di/src/index.ts`

- [ ] **Step 1: Delete `isOptionalFactoryDependency` from `utils.ts`**

Open `packages/di/src/utils.ts`. Delete the entire `isOptionalFactoryDependency` function and its import of `OptionalFactoryDependency` from the import list at the top.

The import at the top currently includes `OptionalFactoryDependency`:

```ts
import type {
  Token,
  Provider,
  Constructor,
  ValueProvider,
  ClassProvider,
  FactoryProvider,
  ExistingProvider,
} from "./types.js";
```

And delete the entire function:

```ts
// DELETE this entire function — it no longer exists
export function isOptionalFactoryDependency<T>(
  dep: Token<T> | OptionalFactoryDependency<T>,
): dep is OptionalFactoryDependency<T> {
  return (
    typeof dep === "object" &&
    dep !== null &&
    "optional" in dep &&
    (dep as OptionalFactoryDependency<T>).optional === true
  );
}
```

- [ ] **Step 2: Remove `OptionalFactoryDependency` from `index.ts` barrel export**

Open `packages/di/src/index.ts`. Remove `OptionalFactoryDependency` from the `export type { ... }` block:

```ts
export type {
  Token,
  Provider,
  Constructor,
  ClassProvider,
  ValueProvider,
  ExistingProvider,
  FactoryProvider,
} from "./types.js";
```

- [ ] **Step 3: Build to confirm no dangling references**

```bash
pnpm --filter @decorify/di build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Run full test suite one more time**

```bash
pnpm --filter @decorify/di exec vitest run src/container.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/di/src/utils.ts packages/di/src/index.ts
git commit -m "refactor(di): delete isOptionalFactoryDependency; remove OptionalFactoryDependency export"
```

---

## Task 5: Update `packages/di/README.md`

**Files:**

- Modify: `packages/di/README.md`

- [ ] **Step 1: Replace the inject-array factory examples**

In the `container.register(provider, opts?)` section, find and replace the three inject-array blocks (lines ~119–139):

```md
// Factory provider with injected dependencies
container.register({
provide: LOGGER,
useFactory: (config: AppConfig) => new Logger({ level: config.logLevel }),
inject: [APP_CONFIG],
});

// Async factory with injected dependencies (sync or async)
container.register({
provide: USER_REPO,
useFactory: async (db: Database) => new UserRepository(db),
inject: [DATABASE],
});

// Factory provider with optional dependency
container.register({
provide: LOGGER,
useFactory: (config?: AppConfig) =>
new Logger({ level: config?.logLevel ?? "info" }),
inject: [{ token: APP_CONFIG, optional: true }],
});
```

Replace with:

```md
// Factory provider with injected dependencies (use inject() inside)
container.register({
provide: LOGGER,
useFactory: () => new Logger({ level: inject(APP_CONFIG).logLevel }),
});

// Async factory with injected dependencies
container.register({
provide: USER_REPO,
useFactory: async () => new UserRepository(inject(DATABASE)),
});
```

- [ ] **Step 2: Remove `OptionalFactoryDependency` from the Types import block**

Find the Types section (line ~270) and remove `OptionalFactoryDependency` from the import block:

```ts
import type {
  Constructor,
  Token,
  Provider,
  ClassProvider,
  ValueProvider,
  FactoryProvider,
  ExistingProvider,
} from "@decorify/di";
```

- [ ] **Step 3: Commit**

```bash
git add packages/di/README.md
git commit -m "docs(di): update README — replace inject-array examples with inject() inside factory"
```

---

## Task 6: Verify `CLAUDE.md` — no changes expected

**Files:**

- Verify: `CLAUDE.md`

`CLAUDE.md` does not currently mention the `inject` array or `OptionalFactoryDependency` — both were omitted from the architecture description when the file was written. This task is a sanity check to confirm nothing slipped in.

- [ ] **Step 1: Confirm no inject-array references exist**

```bash
grep -n "OptionalFactoryDependency\|inject array\|inject:" CLAUDE.md
```

Expected: no output. If anything appears, remove the offending line and commit:

```bash
git add CLAUDE.md
git commit -m "docs: remove stale inject-array reference from CLAUDE.md"
```

If the grep returns nothing, no commit needed — move to Task 7.

---

## Task 7: Final verification

- [ ] **Step 1: Run all package tests**

```bash
pnpm test
```

Expected: all suites pass across `@decorify/di`, `@decorify/core`, and `@decorify/express-adapter`.

- [ ] **Step 2: Build all packages**

```bash
pnpm build
```

Expected: all three packages build successfully in order (di → core → express-adapter).

- [ ] **Step 3: Verify `OptionalFactoryDependency` is gone**

```bash
grep -r "OptionalFactoryDependency" packages/ CLAUDE.md README.md
```

Expected: no output. If anything appears, trace it back to the relevant task and fix.

- [ ] **Step 4: Verify `inject` array usage is gone from source**

```bash
grep -r '"inject"' packages/di/src/ --include="*.ts" | grep -v ".test.ts"
grep -r "inject:" packages/di/src/ --include="*.ts" | grep -v ".test.ts"
```

Expected: no matches in non-test source files. (`.test.ts` files should also be clean after Task 1.)

- [ ] **Step 5: Verify root README has no inject-array examples**

```bash
grep -n "inject:" README.md
```

Expected: no output. The root README already uses `inject()`-inside-factory patterns — this just confirms nothing was missed.
