# Decorify

A framework-agnostic micro-framework for building production-ready HTTP backends using **Stage 3 ES Decorators** (no `experimentalDecorators` required).

## Packages

| Package                                            | Description                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| [`@decorify/di`](./packages/di)                    | Standalone IoC container with `@Injectable`, `inject()`, and `@Inject` |
| [`@decorify/core`](./packages/core)                | HTTP framework — routing, middleware, modules, and error handling      |
| [`@decorify/express`](./packages/adapters/express) | Express 5 adapter for `@decorify/core`                                 |

## Features

- **Stage 3 ES Decorators** — uses the TC39 standard, not legacy TypeScript experimental decorators
- **Framework-agnostic** — pluggable `HttpAdapter` interface; ships with an Express 5 adapter
- **Dependency Injection** — IoC container with unified provider API, `InjectionToken`, lifetimes (singleton/transient/scoped), circular & captive dependency detection, and `AsyncLocalStorage`-based `inject()`
- **Module System** — `defineModule()` for organizing providers, controllers, and per-module middleware
- **Routing** — `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`
- **Middleware** — `@UseMiddleware` at class or method level; Koa-style onion model
- **Error Handling** — built-in `HttpException` subclasses and `defaultErrorHandler`

## Requirements

- Node.js >= 22
- pnpm (enforced via `only-allow`)

## Installation

```bash
pnpm add @decorify/core
# Express adapter (requires express as peer dependency)
pnpm add @decorify/express express
```

> `@decorify/core` re-exports everything from `@decorify/di`, so you only need one import in most cases.

## Quick Start

```ts
// app.ts
import { Application, defineModule } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express";
import { UserController } from "./user.controller.js";

export async function bootstrap() {
  const app = await Application.create({
    adapter: new ExpressAdapter(),
    modules: [
      defineModule({
        name: "user",
        controllers: [UserController],
      }),
    ],
  });
  return app;
}

// main.ts
const app = await bootstrap();
await app.listen(3000);
console.log("Server listening on port 3000");
```

## Modules

Modules are the primary way to organize features. Each module declares its own providers, controllers, and optional per-module middleware.

```ts
import { defineModule } from "@decorify/core";
import { UserController } from "./user.controller.js";
import { UserService } from "./user.service.js";
import { UserRepository } from "./user.repository.js";

export const userModule = defineModule({
  name: "user",
  providers: [UserRepository, UserService],
  controllers: [UserController],
  middlewares: [logger], // applies to all routes in this module
});
```

Pass all modules to `Application.create()`:

```ts
const app = await Application.create({
  adapter: new ExpressAdapter(),
  modules: [databaseModule, configModule, userModule],
  globalMiddleware: [requestId], // applies to every route
  errorHandler: myErrorHandler, // defaults to defaultErrorHandler
});
```

## Routing

```ts
import { Controller, Get, Post, inject } from "@decorify/core";
import type { HttpContext } from "@decorify/core";

@Controller("/users")
export class UserController {
  private service = inject(UserService);

  @Get("/")
  getAll() {
    return this.service.findAll();
  }

  @Get("/:id")
  getOne(ctx: HttpContext) {
    return this.service.findById(ctx.req.params.id!);
  }

  @Post("/")
  async create(ctx: HttpContext) {
    const body = await ctx.req.body();
    const user = await this.service.create(body);
    ctx.res.status(201).json(user);
  }
}
```

Returning a value from a handler automatically sends it as a JSON response. Returning nothing sends `204 No Content`.

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

@Controller("/users")
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

## Middleware

Middleware follows a Koa-style onion model. Use `@UseMiddleware` at the class or method level:

```ts
import type { Middleware } from "@decorify/core";

const logger: Middleware = async (ctx, next) => {
  console.log(`${ctx.req.method.toUpperCase()} ${ctx.req.path}`);
  await next();
};

// Global — via Application.create()
const app = await Application.create({
  adapter: new ExpressAdapter(),
  modules: [...],
  globalMiddleware: [logger],
});

// Controller-level
@UseMiddleware(logger)
@Controller("/api")
class ApiController {
  /* ... */
}

// Method-level
class OrderController {
  @UseMiddleware(logger)
  @Post("/")
  create(ctx: HttpContext) {
    /* ... */
  }
}
```

Execution order: **global → module → class → method**.

## Error Handling

```ts
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  defaultErrorHandler,
} from "@decorify/core";

// Throw anywhere in a handler or middleware
throw new NotFoundException("User not found");

// defaultErrorHandler is used automatically; override per application
const app = await Application.create({
  adapter: new ExpressAdapter(),
  modules: [...],
  errorHandler: async (err, ctx) => {
    ctx.res.status(500).json({ message: "Something went wrong" });
  },
});
```

### Custom Error Handler

```ts
import type { ErrorHandler } from "@decorify/core";

const myErrorHandler: ErrorHandler = async (err, ctx) => {
  if (ctx.res.sent) return;
  if (err instanceof HttpException) {
    return ctx.res.status(err.status).json(err.toJSON());
  }
  ctx.res.status(500).json({ message: "Internal Server Error" });
};
```

## HttpContext API

Every route handler and middleware receives an `HttpContext` object:

### `ctx.req` — HttpRequest

| Property / Method | Description                                |
| ----------------- | ------------------------------------------ |
| `method`          | HTTP method (lowercase)                    |
| `path`            | Request path                               |
| `url`             | Full request URL                           |
| `params`          | URL path parameters (`{ id: "42" }`)       |
| `query`           | Query string parameters                    |
| `headers`         | Request headers                            |
| `body<T>()`       | Async method — returns parsed request body |

### `ctx.res` — HttpResponse

| Property / Method      | Description                              |
| ---------------------- | ---------------------------------------- |
| `sent`                 | Whether a response has already been sent |
| `status(code)`         | Set response status code (chainable)     |
| `header(name, value)`  | Set a response header (chainable)        |
| `json(data)`           | Send a JSON response                     |
| `send(data)`           | Send a plain text / Buffer response      |
| `stream(body)`         | Stream a NodeJS ReadableStream response  |
| `redirect(url, code?)` | Redirect to a URL                        |
| `end()`                | End the response with no body            |

### Other

| Property | Description                                              |
| -------- | -------------------------------------------------------- |
| `state`  | Per-request `Map<string \| symbol, unknown>`             |
| `raw`    | Escape hatch — `{ req: TReq, res: TRes }` native objects |

## Custom Adapters

Implement the `HttpAdapter` interface to add support for any HTTP framework:

```ts
import type { HttpAdapter, RouteDefinition } from "@decorify/core";

export class MyAdapter implements HttpAdapter {
  registerRoute(route: RouteDefinition): void {
    // route.method, route.path, route.handler
  }
  async listen(port: number, host?: string): Promise<void> {
    /* ... */
  }
  async close(): Promise<void> {
    /* ... */
  }
  get native(): unknown {
    /* return underlying framework instance */
  }
}
```

## Monorepo Structure

```
decorify/
├── packages/
│   ├── di/                     # @decorify/di — standalone IoC container
│   ├── core/                   # @decorify/core — HTTP framework
│   └── adapters/
│       └── express/            # @decorify/express — Express 5 adapter
├── tsconfig.base.json
└── vitest.config.ts
```

### Workspace Commands

```bash
pnpm install          # install all dependencies
pnpm build            # build all packages (di → core → express)
pnpm test             # run all test suites
pnpm format           # check formatting with prettier
pnpm clean            # remove all dist/ directories
```

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)
