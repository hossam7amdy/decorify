# @decorify/core

Framework-agnostic HTTP backend framework built on **Stage 3 ES Decorators**. Provides routing, middleware, modules, and error handling. Pairs with an adapter (e.g. `@decorify/express`) to run on any HTTP framework.

Re-exports everything from `@decorify/di`, so you only need to install this package for most use cases.

## Installation

```bash
pnpm add @decorify/core
```

> Node.js >= 22 required.

## Quick Start

```ts
import { Application, defineModule } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express";
import { UserController } from "./user.controller.js";
import { UserService } from "./user.service.js";

const app = await Application.create({
  adapter: new ExpressAdapter(),
  modules: [
    defineModule({
      name: "user",
      providers: [UserService],
      controllers: [UserController],
    }),
  ],
});

await app.listen(3000);
```

## Application

### `Application.create(opts)`

Static async factory. Registers all providers and controllers from the provided modules, then returns the `Application` instance.

```ts
interface ApplicationOptions {
  readonly adapter: HttpAdapter;
  readonly modules: readonly ModuleDefinition[];
  readonly container?: Container; // provide your own DI container
  readonly globalMiddleware?: readonly Middleware[]; // runs before every route
  readonly errorHandler?: ErrorHandler; // defaults to defaultErrorHandler
}

const app = await Application.create({
  adapter: new ExpressAdapter(),
  modules: [databaseModule, userModule],
  globalMiddleware: [requestLogger],
  errorHandler: myErrorHandler,
});
```

### `app.listen(port, host?)`

Starts the server on the given port (and optional host).

### `app.close()`

Disposes the DI container (runs `[Symbol.asyncDispose]` on instances) and shuts down the adapter.

### Graceful Shutdown

```ts
const signals = ["SIGTERM", "SIGINT"] as const;
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\nReceived ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  });
});
```

### `app.resolve(token)`

Resolve a registered DI token after the application has been created.

```ts
const config = app.resolve(CONFIG_TOKEN);
```

### `app.getAdapter()`

Returns the underlying `HttpAdapter` instance. Cast to the concrete type if you need adapter-specific properties.

```ts
import type { ExpressAdapter } from "@decorify/express";
const expressApp = (app.getAdapter() as ExpressAdapter).native;
```

### `app.getRoutes()`

Returns an array of all registered routes (method, path, controller name) — useful for debugging or documentation generation.

## Modules

Modules organize providers, controllers, and per-module middleware into logical feature groups. All providers from all modules share a single root `Container`.

```ts
import { defineModule } from "@decorify/core";

export const userModule = defineModule({
  name: "user",
  providers: [UserRepository, UserService],
  controllers: [UserController],
  middlewares: [authMiddleware], // applies to all controllers in this module
});
```

```ts
interface ModuleDefinition {
  readonly name: string;
  readonly providers?: readonly Provider[];
  readonly controllers?: readonly Constructor[];
  readonly middlewares?: readonly Middleware[];
}
```

## Routing

```ts
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  inject,
} from "@decorify/core";
import type { HttpContext } from "@decorify/core";

@Controller("/users")
export class UserController {
  private service = inject(UserService);

  @Get("/")
  getAll(): User[] {
    return this.service.findAll();
  }

  @Get("/:id")
  getOne(ctx: HttpContext) {
    return this.service.findById(ctx.req.params.id!);
  }

  @Post("/")
  async create(ctx: HttpContext) {
    const body = await ctx.req.body<CreateUserDto>();
    const user = await this.service.create(body);
    ctx.res.status(201).json(user);
  }

  @Put("/:id")
  update(ctx: HttpContext) {
    /* ... */
  }

  @Patch("/:id")
  patch(ctx: HttpContext) {
    /* ... */
  }

  @Delete("/:id")
  async remove(ctx: HttpContext) {
    await this.service.delete(ctx.req.params.id!);
    ctx.res.status(204).end();
  }
}
```

**Response behavior:**

| Handler action                           | Framework behavior                         |
| ---------------------------------------- | ------------------------------------------ |
| Returns a value, doesn't touch `ctx.res` | Auto-serializes via `ctx.res.json(result)` |
| Calls `ctx.res.*` (sets `sent = true`)   | Framework skips auto-encode                |
| Returns nothing, doesn't touch `ctx.res` | Sends `204 No Content` via `ctx.res.end()` |

## Middleware

Middleware follows a Koa-style onion model. Use `@UseMiddleware` at the class or method level, or pass `globalMiddleware` to `Application.create()`.

```ts
import type { Middleware } from "@decorify/core";

const logger: Middleware = async (ctx, next) => {
  console.log(`→ ${ctx.req.method.toUpperCase()} ${ctx.req.path}`);
  await next();
  console.log(`← done`);
};

// Global — via Application.create()
const app = await Application.create({
  adapter,
  modules: [...],
  globalMiddleware: [logger],
});

// Module-level (applies to all controllers in the module)
defineModule({
  name: "api",
  middlewares: [logger],
  controllers: [ApiController],
});

// Controller-level (applies to all routes in the class)
@UseMiddleware(logger)
@Controller("/api")
class ApiController {
  /* ... */
}

// Method-level
class OrderController {
  @UseMiddleware(logger)
  @Post("/")
  create(ctx: HttpContext) { /* ... */ }
}
```

Execution order: **global → module → class → method**.

## Error Handling

### Built-in exceptions

```ts
import {
  HttpException,
  BadRequestException, // 400
  UnauthorizedException, // 401
  ForbiddenException, // 403
  NotFoundException, // 404
  MethodNotAllowedException, // 405
  ConflictException, // 409
  UnprocessableEntityException, // 422
  TooManyRequestsException, // 429
  InternalServerErrorException, // 500
} from "@decorify/core";
import { HttpStatus } from "@decorify/core";

throw new NotFoundException("User not found");
throw new BadRequestException("Invalid input");
throw new HttpException(HttpStatus.NOT_IMPLEMENTED, "Not ready yet");
```

### `defaultErrorHandler`

Used automatically when no `errorHandler` is passed to `Application.create()`. Handles `HttpException` instances automatically; for unknown errors it returns a 500 response (with stack trace outside production).

```ts
import { defaultErrorHandler } from "@decorify/core";

const app = await Application.create({
  adapter,
  modules: [...],
  errorHandler: defaultErrorHandler, // explicit, but this is the default
});
```

### Custom error handler

```ts
import type { ErrorHandler } from "@decorify/core";

const myErrorHandler: ErrorHandler = async (err, ctx) => {
  if (ctx.res.sent) return;
  if (err instanceof HttpException) {
    return ctx.res.status(err.status).json(err.toJSON());
  }
  ctx.res.status(500).json({ message: "Internal Server Error" });
};

const app = await Application.create({
  adapter,
  modules: [...],
  errorHandler: myErrorHandler,
});
```

## HttpContext API

Every route handler and middleware receives an `HttpContext`:

### `ctx.req` — HttpRequest

| Property / Method | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `native`          | Underlying framework request object (escape hatch)        |
| `method`          | HTTP method, uppercase: `"GET"`, `"POST"`, etc.           |
| `path`            | Request path, without query string                        |
| `url`             | Full request URL including query string                   |
| `params`          | URL path parameters (`{ id: "42" }`); `{}` when none      |
| `query`           | Query string parameters; repeated keys yield arrays       |
| `headers`         | Request headers, accessible via lowercase key             |
| `body<T>()`       | Async — returns parsed request body; memoized per request |

### `ctx.res` — HttpResponse

| Property / Method      | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `native`               | Underlying framework response object (escape hatch)   |
| `sent`                 | `false` before response; `true` after any send method |
| `status(code)`         | Set response status code (chainable)                  |
| `header(name, value)`  | Set a response header (chainable)                     |
| `json(data)`           | Send a JSON response                                  |
| `send(data)`           | Send a plain text / Buffer response                   |
| `redirect(url, code?)` | Redirect to a URL                                     |
| `end()`                | End the response with no body                         |

### Other

| Property | Description                                               |
| -------- | --------------------------------------------------------- |
| `state`  | Per-request `Record<string, unknown>` — fresh per request |

## Custom Adapters

Implement `HttpAdapter` to integrate with any HTTP framework:

```ts
import type { HttpAdapter, RouteDefinition } from "@decorify/core";

export class MyAdapter implements HttpAdapter {
  registerRoute(route: RouteDefinition): void {
    // route.method — "GET" | "POST" | ...
    // route.path   — ":param" style
    // route.handler — (ctx: HttpContext) => Promise<unknown> | unknown
  }

  async listen(port: number, host?: string): Promise<void> {
    // Start server
  }

  async close(): Promise<void> {
    // Shutdown server
  }

  get native(): unknown {
    // Return underlying framework instance
  }
}
```

## Dependency Injection

`@decorify/core` re-exports the full `@decorify/di` API:

```ts
import {
  Injectable,
  inject,
  Inject,
  Container,
  Lifetime,
} from "@decorify/core";
import type { Token, Constructor } from "@decorify/core";
```

See the [`@decorify/di` README](../di/README.md) for full DI documentation.

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)
