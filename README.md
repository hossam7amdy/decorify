# Decorify

A framework-agnostic micro-framework for building production-ready HTTP backends using **Stage 3 ES Decorators** (no `experimentalDecorators` required).

## Packages

| Package                                                   | Description                                                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`@decorify/di`](./packages/di)                           | Standalone IoC container with `@Injectable`, `inject()`, and `@Inject` |
| [`@decorify/core`](./packages/core)                       | HTTP framework — routing, middleware, guards, filters, lifecycle hooks |
| [`@decorify/express-adapter`](./packages/express-adapter) | Express 5 adapter for `@decorify/core`                                 |

## Features

- **Stage 3 ES Decorators** — uses the TC39 standard, not legacy TypeScript experimental decorators
- **Framework-agnostic** — pluggable `HttpAdapter` interface; ships with an Express 5 adapter
- **Dependency Injection** — IoC container with unified provider API, `InjectionToken`, lifetimes (singleton/transient/scoped), circular & captive dependency detection, and `AsyncLocalStorage`-based `inject()`
- **Routing** — `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`
- **Middleware & Guards** — `@UseMiddleware`, `@UseGuard` at class or method level
- **Exception Filters** — `@UseFilter` and built-in `HttpException` subclasses
- **Lifecycle Hooks** — `OnInit` / `OnDestroy` interfaces called on startup and shutdown

## Requirements

- Node.js >= 22
- pnpm (enforced via `only-allow`)

## Installation

```bash
pnpm add @decorify/core
# Express adapter (requires express as peer dependency)
pnpm add @decorify/express-adapter express
```

> `@decorify/core` re-exports everything from `@decorify/di`, so you only need one import in most cases.

## Quick Start

```ts
// main.ts
import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { UserController } from "./user.controller.js";

const app = new Application(new ExpressAdapter());

app.register([UserController]);

await app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
```

## Routing

```ts
import { Controller, Get, Post, Injectable } from "@decorify/core";
import type { HttpContext } from "@decorify/core";

@Injectable()
@Controller("/users")
export class UserController {
  @Get("/")
  getAll(_ctx: HttpContext) {
    return [{ id: 1, name: "Alice" }];
  }

  @Get("/:id")
  getOne(ctx: HttpContext) {
    return { id: ctx.params.id };
  }

  @Post("/")
  create(ctx: HttpContext) {
    ctx.status(201).json(ctx.body);
  }
}
```

Returning a value from a handler automatically sends it as a JSON response.

## Dependency Injection

```ts
import {
  Injectable,
  inject,
  Inject,
  InjectionToken,
  Lifetime,
} from "@decorify/core";

@Injectable()
export class UserRepository {
  /* ... */
}

@Injectable()
export class UserService {
  // functional injection (field initializer)
  private repo = inject(UserRepository);
}

@Injectable()
export class UserController {
  // decorator-based field injection
  @Inject(UserService) private service!: UserService;
}
```

### InjectionToken & Provider Types

```ts
const DB_URL = new InjectionToken<string>("DB_URL");

container.register({ provide: DB_URL, useValue: "postgres://localhost/mydb" });
container.register({
  provide: CacheService,
  useClass: RedisCacheService,
  lifetime: Lifetime.SCOPED,
});
container.register({ provide: LOGGER, useFactory: () => createLogger() });
container.register({ provide: AliasToken, useExisting: CacheService });
```

## Middleware & Guards

```ts
import { Application, UseMiddleware, UseGuard } from "@decorify/core";
import type { HttpContext, MiddlewareHandler, Guard } from "@decorify/core";

const logger: MiddlewareHandler = async (ctx, next) => {
  console.log(`${ctx.method.toUpperCase()} ${ctx.path}`);
  await next();
};

const authGuard: Guard = {
  async canActivate(ctx) {
    return ctx.headers.authorization === "Bearer secret";
  },
};

// Global
app.useMiddleware(logger);
// Pass instances or DI Constructors!
app.useGlobalGuard(AuthGuard);

// Controller-level
@UseMiddleware(logger)
@UseGuard(AuthGuard)
@Controller("/admin")
class AdminController {
  /* ... */
}

// Method-level
class PostController {
  @UseGuard(authGuard) // Can also pass instances directly
  @Delete("/:id")
  delete(ctx: HttpContext) {
    /* ... */
  }
}
```

Guards run **after middleware** and before the route handler. This allows middleware to parse payloads or set state (e.g. `ctx.user`) which guards can subsequently authorize.

## Exception Handling

```ts
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  DefaultExceptionFilter,
  UseFilter,
} from "@decorify/core";

// Throw anywhere in a handler or guard
throw new NotFoundException("User not found");

// Apply globally (by instance or constructor)
app.useGlobalFilter(DefaultExceptionFilter);

// Or per controller / method
@UseFilter(DefaultExceptionFilter)
@Controller("/users")
class UserController {
  /* ... */
}
```

### Custom Exception Filter

```ts
import type { ExceptionFilter, HttpContext } from "@decorify/core";
import { Injectable, inject } from "@decorify/core";

@Injectable()
class MyFilter implements ExceptionFilter {
  private logger = inject(LoggerService);

  catch(error: Error, ctx: HttpContext): void {
    this.logger.error(error);
    ctx.status(422).json({ message: error.message });
  }
}
```

_Note: `@UseGuard` and `@UseFilter` fully support `@decorify/di`. Passing a class reference (constructor) allows the framework to dynamically resolve your guard or filter with its injected dependencies!_

## Lifecycle Hooks

```ts
import { Injectable } from "@decorify/core";
import type { OnInit, OnDestroy } from "@decorify/core";

@Injectable()
export class DatabaseService implements OnInit, OnDestroy {
  async onInit() {
    await db.connect();
  }

  async onDestroy() {
    await db.disconnect();
  }
}
```

`onInit()` is called after all controllers are registered, before the server starts listening. `onDestroy()` is called when `app.close()` is invoked.

## HttpContext API

Every route handler receives an `HttpContext` object:

| Property / Method        | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `method`                 | HTTP method (lowercase)                               |
| `path`                   | Request path                                          |
| `params`                 | URL path parameters (`{ id: "42" }`)                  |
| `query`                  | Query string parameters                               |
| `headers`                | Request headers                                       |
| `body`                   | Parsed request body                                   |
| `status(code)`           | Set response status code (chainable)                  |
| `json(data)`             | Send a JSON response                                  |
| `send(data)`             | Send a plain text / Buffer response                   |
| `setHeader(name, value)` | Set a response header (chainable)                     |
| `raw`                    | Escape hatch to the underlying `{ req, res }` objects |

## Custom Adapters

Implement the `HttpAdapter` interface to add support for any HTTP framework:

```ts
import type {
  HttpAdapter,
  HttpContext,
  RouteHandler,
  MiddlewareHandler,
  ErrorHandler,
} from "@decorify/core";

export class MyAdapter implements HttpAdapter {
  registerRoute(method: string, path: string, handler: RouteHandler): void {
    /* ... */
  }
  useMiddleware(handler: MiddlewareHandler): void {
    /* ... */
  }
  useErrorHandler(handler: ErrorHandler): void {
    /* ... */
  }
  listen(port: number, callback?: () => void): Promise<void> {
    /* ... */
  }
  close(): Promise<void> {
    /* ... */
  }
  getInstance(): unknown {
    /* ... */
  }
}
```

## Monorepo Structure

```
decorify/
├── packages/
│   ├── di/                     # @decorify/di — standalone IoC container
│   ├── core/                   # @decorify/core — HTTP framework
│   └── express-adapter/        # @decorify/express-adapter — Express 5 adapter
├── tsconfig.base.json
└── vitest.config.ts
```

### Workspace Commands

```bash
pnpm install          # install all dependencies
pnpm build            # build all packages (di → core → express-adapter)
pnpm test             # run all test suites
pnpm test:watch       # watch mode
pnpm test:coverage    # coverage report
pnpm format           # check formatting with prettier
pnpm clean            # remove all dist/ directories
```

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)
