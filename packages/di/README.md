# @decorify/di

Standalone dependency injection container with **Stage 3 ES Decorators** support. Zero framework dependencies — works in any TypeScript project.

## Installation

```bash
pnpm add @decorify/di
```

> Node.js >= 22 required.

## Features

- **Stage 3 decorators** — `experimentalDecorators: false`
- Unified provider API — class, value, factory, and alias providers
- `InjectionToken` for non-class dependencies (config, interfaces)
- Three lifetimes: `singleton`, `transient`, `scoped`
- Circular dependency detection
- Captive dependency detection (prevents longer-lived services from capturing shorter-lived ones)
- Scoped containers via `createScope()`
- `AsyncLocalStorage`-based injection context — `inject()` works in constructors, factories, and nested resolution
- **Async factory support** — `resolveAsync()` handles `Promise`-returning factories for async initialization (DB connections, config vaults, HTTP clients)

## Usage

### `@Injectable`

Marks a class as injectable. Classes decorated with `@Injectable()` are auto-registered when first resolved:

```ts
import { Injectable, Lifetime } from "@decorify/di";

@Injectable()
export class UserRepository {
  findById(id: string) {
    /* ... */
  }
}

// With a custom lifetime
@Injectable({ lifetime: Lifetime.TRANSIENT })
export class RequestLogger {
  /* ... */
}
```

### `inject()` — functional injection

Resolves a dependency inside a field initializer, constructor, or factory function. Must be called during a `container.resolve()` call:

```ts
import { Injectable, inject } from "@decorify/di";

@Injectable()
export class UserService {
  private repo = inject(UserRepository);
}
```

### `@Inject` — field decorator injection

```ts
import { Injectable, Inject } from "@decorify/di";

@Injectable()
export class UserController {
  @Inject(UserService) private service!: UserService;
}
```

### Resolving instances

```ts
import { Container } from "@decorify/di";

const container = new Container();
container.register(UserService);

// Synchronous
const service = container.resolve(UserService);

// Async (for factories that return Promise)
const db = await container.resolveAsync(DatabaseService);
```

## Container API

### `container.register(provider, opts?)`

Register a provider. Accepts a bare constructor, or a structured provider object. Defaults to `singleton` lifetime.

```ts
// Bare class (token = class itself)
container.register(UserService);

// Class provider (abstract token → concrete impl)
container.register({ provide: IUserService, useClass: UserService });

// Value provider
container.register({ provide: DB_URL, useValue: "postgres://localhost/mydb" });

// Sync factory provider
container.register({
  provide: LOGGER,
  useFactory: () => new Logger({ level: "info" }),
});

// Async factory provider
container.register({
  provide: DATABASE,
  useFactory: async () => {
    const db = new Database();
    await db.connect();
    return db;
  },
});

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

// Alias provider
container.register({ provide: ALIAS_TOKEN, useExisting: UserService });

// Override an existing registration
container.register(UserService, { override: true });

// With explicit lifetime
container.register({
  provide: RequestHandler,
  useClass: RequestHandler,
  lifetime: Lifetime.SCOPED,
});
```

### `container.resolve(token)`

Synchronously resolve a token. Throws if:

- The token is not registered (and not `@Injectable`)
- A circular dependency is detected
- A captive dependency is detected
- A factory returns a `Promise` (use `resolveAsync()` instead)

### `container.resolveAsync(token)`

Asynchronously resolve a token. Supports both sync and async factories. Use this when any factory in the dependency graph returns a `Promise`.

```ts
// Boot phase: resolve async singletons once
const db = await container.resolveAsync(DATABASE);

// After resolveAsync(), singletons are cached —
// subsequent sync resolve() calls return the cached instance
const samDb = container.resolve(DATABASE); // works
```

**Concurrent resolution is safe for singletons.** If two `resolveAsync()` calls for the same singleton token race, the factory is only called once — both calls receive the same instance.

```ts
const [a, b] = await Promise.all([
  container.resolveAsync(DATABASE),
  container.resolveAsync(DATABASE),
]);
// a === b, factory called once
```

**`inject()` inside class constructors remains synchronous.** If a class uses `inject(SomeToken)` and `SomeToken` has an async factory, pre-resolve it before resolving the class:

```ts
await container.resolveAsync(DATABASE); // prime the cache
const repo = await container.resolveAsync(UserRepository); // inject(DATABASE) finds cache
```

### `container.createScope()`

Create a child container for resolving `scoped` dependencies. Singletons delegate to the parent.

```ts
const scope = container.createScope();
const handler = scope.resolve(RequestHandler);
await scope.resolveAsync(ScopedAsyncService);
```

### `container.has(token)`

Check if a token is registered (including parent containers):

```ts
container.has(UserService); // true / false
```

### `container.dispose()`

Async. Disposes all tracked instances in reverse resolution order. Any in-flight `resolveAsync()` calls are awaited before disposal begins, preventing disposal of partially-constructed instances.

```ts
await container.dispose();
```

Multiple disposal errors are chained as `SuppressedError`.

### `container.isInInjectionContext`

Returns `true` if called during an active `container.resolve()` or `container.resolveAsync()` call (i.e., inside a constructor, field initializer, or factory).

```ts
container.isInInjectionContext; // false outside resolve
```

## `InjectionToken`

Use `InjectionToken` for non-class dependencies (config values, interfaces, primitives):

```ts
import { InjectionToken } from "@decorify/di";

const DB_URL = new InjectionToken<string>("DB_URL");
const APP_CONFIG = new InjectionToken<AppConfig>("APP_CONFIG");

container.register({ provide: DB_URL, useValue: "postgres://localhost/mydb" });
container.register({
  provide: APP_CONFIG,
  useFactory: async () => loadConfig(), // async factory
});

const url = container.resolve(DB_URL); // string
const config = await container.resolveAsync(APP_CONFIG); // AppConfig
```

## Lifetimes

| Lifetime    | Description                                               |
| ----------- | --------------------------------------------------------- |
| `singleton` | One instance per container (default)                      |
| `transient` | New instance on every `resolve()` / `resolveAsync()` call |
| `scoped`    | One instance per scope created with `createScope()`       |

```ts
import { Lifetime } from "@decorify/di";

container.register({
  provide: MyService,
  useClass: MyService,
  lifetime: Lifetime.TRANSIENT,
});
```

## Types

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

import { InjectionToken, Lifetime, Container } from "@decorify/di";
```

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)
