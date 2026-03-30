# @decorify/di

Standalone dependency injection container with **Stage 3 ES Decorators** support. Zero framework dependencies — works in any TypeScript project.

## Installation

```bash
pnpm add @decorify/di
```

> Node.js >= 22 required.

## Features

- **Stage 3 decorators** — `experimentalDecorators: false`
- Three lifetime scopes: `singleton`, `transient`, `scoped`
- Circular dependency detection
- Captive dependency detection (prevents longer-lived services from capturing shorter-lived ones)
- Async initialization via `AsyncInitializable`
- `registerValue` and `registerFactory` for non-class providers
- Scoped containers via `createScope()`

## Usage

### `@Injectable`

Marks a class as injectable and auto-registers it in the global container:

```ts
import { Injectable } from "@decorify/di";

@Injectable()
export class UserRepository {
  findById(id: string) {
    /* ... */
  }
}

// With a custom lifetime
@Injectable({ lifetime: "transient" })
export class RequestLogger {
  /* ... */
}
```

### `inject()` — functional injection

Resolves a dependency inside a field initializer or constructor. Must be called while the container is constructing an instance.

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
import { container } from "@decorify/di";

const service = container.resolve(UserService);
```

## Container API

### `container.register(token, opts?)`

Register a class provider. Defaults to `singleton` lifetime.

```ts
container.register(UserService);
container.register(UserService, { lifetime: "transient" });
// Register with an abstract token
container.register(IUserService, UserService);
container.register(IUserService, UserService, { override: true });
```

### `container.registerValue(token, value, opts?)`

Register a pre-existing value (always singleton):

```ts
container.registerValue("DB_URL", "postgres://localhost/mydb");
container.registerValue(Config, new Config({ debug: true }));
```

### `container.registerFactory(token, factory, opts?)`

Register a factory function:

```ts
container.registerFactory("Logger", () => new Logger({ level: "info" }));
container.registerFactory("RequestId", () => crypto.randomUUID(), {
  lifetime: "transient",
});
```

### `container.resolve(token)`

Synchronously resolve a token. Throws if the token is not registered or a circular/captive dependency is detected.

### `container.resolveAsync(token)`

Like `resolve`, but additionally calls `init()` on instances that implement `AsyncInitializable`.

```ts
const db = await container.resolveAsync(Database);
```

### `container.createScope()`

Create a child container for resolving `scoped` dependencies. Singletons are still served by the parent.

```ts
const scope = container.createScope();
const handler = scope.resolve(RequestHandler);
```

### `container.validate(tokens)`

Assert that all given tokens are registered. Useful at startup to catch missing registrations early.

```ts
container.validate([UserService, UserRepository]);
```

### `container.clear()`

Remove all instances and registrations. Primarily useful in tests.

## Lifetimes

| Lifetime    | Description                                         |
| ----------- | --------------------------------------------------- |
| `singleton` | One instance per container (default)                |
| `transient` | New instance on every `resolve()` call              |
| `scoped`    | One instance per scope created with `createScope()` |

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
  AbstractConstructor,
  Token,
  Lifetime,
  Provider,
  AsyncInitializable,
} from "@decorify/di";
```

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)
