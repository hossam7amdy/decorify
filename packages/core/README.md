# @decorify/core

Framework-agnostic HTTP backend framework built on **Stage 3 ES Decorators**. Provides routing, middleware, guards, exception filters, and lifecycle hooks. Pairs with an adapter (e.g. `@decorify/express-adapter`) to run on any HTTP framework.

Re-exports everything from `@decorify/di`, so you only need to install this package for most use cases.

## Installation

```bash
pnpm add @decorify/core
```

> Node.js >= 22 required.

## Quick Start

```ts
import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { UserController } from "./user.controller.js";

const app = await Application.create(new ExpressAdapter(), {
  controllers: [UserController],
});

await app.listen(3000, () => console.log("Listening on port 3000"));
```

## Application

### `Application.create(controllers, adapter)`

Static async factory. Registers all controllers and builds route pipelines, then returns the `Application` instance.

```ts
const app = await Application.create(adapter, {
  controllers: [UserController],
});
```

### `app.useMiddleware(...handlers)`

Add global middleware that runs before every route handler.

### `app.useGlobalGuard(...guards)`

Add global guards that run before every route handler.

### `app.useGlobalFilter(...filters)`

Add global exception filters. They run after method- and class-level filters.

### `app.listen(port, callback?)`

Calls `onInit()` on lifecycle-aware instances, then starts the server.

### `app.close()`

Calls `onDestroy()` on all tracked instances, disposes the DI container, and shuts down the adapter.

### Graceful Shutdown

To shut down gracefully on `SIGINT` or `SIGTERM`, ensure you call `app.close()`. This ensures all async hooks, open connections, and DI singletons (via `[Symbol.asyncDispose]`) are cleaned up.

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

### `app.adapter`

Returns the underlying `HttpAdapter` instance.

## Routing

```ts
import {
  Injectable,
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Head,
  Options,
  All,
} from "@decorify/core";
import type { HttpContext } from "@decorify/core";

@Injectable()
@Controller("/users")
export class UserController {
  @Get("/")
  getAll(): User[] {
    return this.service.findAll();
  }

  @Get("/:id")
  getOne(ctx: HttpContext) {
    return this.service.findById(ctx.params.id);
  }

  @Post("/")
  create(ctx: HttpContext) {
    ctx.status(201).json(this.service.create(ctx.body));
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
  remove(ctx: HttpContext) {
    /* ... */
  }
}
```

Returning a value from a handler automatically serializes it as a JSON response. Static paths are registered before parameterized ones (e.g. `/users/me` before `/users/:id`).

## Middleware

Middleware follows a Koa-style onion model. Use `@UseMiddleware` at the class or method level:

```ts
import type { MiddlewareHandler } from "@decorify/core";

const logger: MiddlewareHandler = async (ctx, next) => {
  console.log(`→ ${ctx.method.toUpperCase()} ${ctx.path}`);
  await next();
  console.log(`← done`);
};

// Global
app.useMiddleware(logger);

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
  create(ctx: HttpContext) {
    /* ... */
  }
}
```

Execution order: **global → class → method**.

## Guards

Guards authorize requests. If `canActivate` returns `false`, a `ForbiddenException` is thrown automatically.

```ts
import type { Guard } from "@decorify/core";

const authGuard: Guard = {
  async canActivate(ctx) {
    return !!ctx.headers.authorization;
  },
};

// Global (Pass instances or DI constructors)
app.useGlobalGuard(AuthGuard);

// Controller-level
@UseGuard(AuthGuard)
@Controller("/admin")
class AdminController {
  /* ... */
}

// Method-level
class UserController {
  @UseGuard(authGuard) // Supports instances too
  @Delete("/:id")
  delete(ctx: HttpContext) {
    /* ... */
  }
}
```

Guards run **after middleware** and before the route handler. This allows middleware to parse payloads which guards can inspect.

## Exception Filters

Filters handle errors thrown anywhere in the pipeline (guards, middleware, or handlers).

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
throw new BadRequestException("Invalid input", { field: "email" });
throw new HttpException(HttpStatus.NOT_IMPLEMENTED, "Not ready yet");
```

### `DefaultExceptionFilter`

Handles `HttpException` instances automatically. For unknown errors it logs and returns a 500 response.

```ts
import { DefaultExceptionFilter } from "@decorify/core";

// Can pass either an instance or constructor
app.useGlobalFilter(DefaultExceptionFilter);
```

### Custom filter

```ts
import type { ExceptionFilter, HttpContext } from "@decorify/core";
import { Injectable, inject } from "@decorify/core";

@Injectable()
class ValidationFilter implements ExceptionFilter {
  private logger = inject(LoggerService);

  catch(error: Error, ctx: HttpContext): void {
    this.logger.log(error);
    ctx.status(422).json({ message: error.message });
  }
}

// Apply at class or method level (can pass class constructor for DI resolution)
@UseFilter(ValidationFilter)
@Controller("/users")
class UserController {
  /* ... */
}
```

Filter resolution order: **method-level → class-level → global → DefaultExceptionFilter**.

## Lifecycle Hooks

Implement `OnInit` and/or `OnDestroy` on any `@Injectable` class that is used by a registered controller:

```ts
import { Injectable } from "@decorify/core";
import type { OnInit, OnDestroy } from "@decorify/core";

@Injectable()
export class DatabaseService implements OnInit, OnDestroy {
  async onInit() {
    await this.pool.connect();
  }

  async onDestroy() {
    await this.pool.end();
  }
}
```

- `onInit()` — called before `listen()` starts accepting requests
- `onDestroy()` — called when `app.close()` is invoked; runs in reverse registration order

## HttpContext API

Every route handler receives an `HttpContext`:

| Property / Method        | Description                               |
| ------------------------ | ----------------------------------------- |
| `method`                 | HTTP method (lowercase)                   |
| `path`                   | Request path                              |
| `params`                 | URL path parameters (`{ id: "42" }`)      |
| `query`                  | Query string parameters                   |
| `headers`                | Request headers                           |
| `body`                   | Parsed request body                       |
| `status(code)`           | Set response status code (chainable)      |
| `json(data)`             | Send a JSON response                      |
| `send(data)`             | Send a plain text / Buffer response       |
| `setHeader(name, value)` | Set a response header (chainable)         |
| `redirect(url, code?)`   | Redirect to a URL                         |
| `responseSent`           | Check if a response has already been sent |

_Note: Access to underlying framework request/response objects is provided through `InjectableContext` module augmentation._

## Custom Adapters

Implement `HttpAdapter` to integrate with any HTTP framework:

```ts
import type { HttpAdapter, RouteHandler } from "@decorify/core";

export class MyAdapter implements HttpAdapter {
  registerRoute(method: string, path: string, handler: RouteHandler): void {
    // Register route with your framework
  }

  async listen(port: number, callback?: () => void): Promise<void> {
    // Start server
  }

  async close(): Promise<void> {
    // Shutdown server
  }

  getInstance(): unknown {
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
