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
- Three scopes: `singleton`, `transient`, `scoped`
- Circular dependency detection
- Captive dependency detection (prevents longer-lived services from capturing shorter-lived ones)
- Async factories and async initialization via `AsyncInitializable`
- Scoped containers via `createScope()`
- `AsyncLocalStorage`-based injection context — `inject()` works in constructors, factories, and nested resolution

## Usage

### `@Injectable`

Marks a class as injectable. Classes decorated with `@Injectable()` are auto-registered when first resolved:

```ts
import { Injectable, Scope } from "@decorify/di";

@Injectable()
export class UserRepository {
  findById(id: string) {
    /* ... */
  }
}

// With a custom scope
@Injectable({ scope: Scope.Transient })
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
const service = container.resolve(UserService);
```

## Container API

### `container.register(provider, opts?)`

Register a provider. Accepts a bare constructor, or a structured provider object. Defaults to `singleton` scope.

```ts
// Bare class (token = class itself)
container.register(UserService);

// Class provider (abstract token → concrete impl)
container.register({ provide: IUserService, useClass: UserService });

// Value provider
container.register({ provide: DB_URL, useValue: "postgres://localhost/mydb" });

// Factory provider
container.register({
  provide: LOGGER,
  useFactory: () => new Logger({ level: "info" }),
});

// Async factory (must use resolveAsync)
container.register({
  provide: DB_CONNECTION,
  useFactory: async () => await connectToDatabase(),
});

// Alias provider
container.register({ provide: ALIAS_TOKEN, useExisting: UserService });

// Override an existing registration
container.register(UserService, { override: true });

// With explicit scope
container.register({
  provide: RequestHandler,
  useClass: RequestHandler,
  scope: Scope.Scoped,
});
```

### `container.registerMany(providers)`

Register multiple providers at once:

```ts
container.registerMany([
  UserRepository,
  UserService,
  { provide: DB_URL, useValue: "postgres://localhost/mydb" },
]);
```

### `container.resolve(token)`

Synchronously resolve a token. Throws if:

- The token is not registered (and not `@Injectable`)
- A circular dependency is detected
- A captive dependency is detected
- A factory returns a `Promise` (use `resolveAsync` instead)

### `container.resolveAsync(token)`

Like `resolve`, but supports async factories and calls `init()` on instances implementing `AsyncInitializable`:

```ts
const db = await container.resolveAsync(Database);
```

### `container.createScope()`

Create a child container for resolving `scoped` dependencies. Singletons delegate to the parent.

```ts
const scope = container.createScope();
const handler = scope.resolve(RequestHandler);
```

### `container.has(token)`

Check if a token is registered (including parent containers):

```ts
container.has(UserService); // true / false
```

### `container.validate(tokens)`

Assert that all given tokens are registered. Useful at startup:

```ts
container.validate([UserService, UserRepository]);
```

### `container.clear()`

Remove all instances and registrations. Primarily useful in tests.

## `InjectionToken`

Use `InjectionToken` for non-class dependencies (config values, interfaces, primitives):

```ts
import { InjectionToken } from "@decorify/di";

const DB_URL = new InjectionToken<string>("DB_URL");
const APP_CONFIG = new InjectionToken<AppConfig>("APP_CONFIG");

container.register({ provide: DB_URL, useValue: "postgres://localhost/mydb" });
container.register({
  provide: APP_CONFIG,
  useFactory: () => loadConfig(),
});

// Resolve
const url = container.resolve(DB_URL); // string
```

## Scopes

| Scope       | Description                                         |
| ----------- | --------------------------------------------------- |
| `singleton` | One instance per container (default)                |
| `transient` | New instance on every `resolve()` call              |
| `scoped`    | One instance per scope created with `createScope()` |

```ts
import { Scope } from "@decorify/di";

container.register({
  provide: MyService,
  useClass: MyService,
  scope: Scope.Transient,
});
```

## Async Initialization

Implement the `AsyncInitializable` interface and resolve with `resolveAsync`:

```ts
import type { AsyncInitializable } from "@decorify/di";

@Injectable()
class Database implements AsyncInitializable {
  async init() {
    await this.connect();
  }
}

const db = await container.resolveAsync(Database);
```

## Types

```ts
import type {
  Constructor,
  Token,
  Scope,
  Provider,
  NormalizedProvider,
  ClassProvider,
  ValueProvider,
  FactoryProvider,
  ExistingProvider,
  AsyncInitializable,
} from "@decorify/di";

import { InjectionToken, Scope as ScopeValue, Container } from "@decorify/di";
```

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)
