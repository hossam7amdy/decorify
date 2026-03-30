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

const app = new Application(new ExpressAdapter());

app.register([UserController]);

await app.listen(3000, () => console.log("Listening on port 3000"));
```

## Application

### `new Application(adapter)`

Creates an application instance wrapping an `HttpAdapter`.

```ts
const app = new Application(adapter);
```

### `app.register(controllers)`

Register one or more controller classes. Returns `this` for chaining.

### `app.useMiddleware(...handlers)`

Add global middleware that runs before every route handler.

### `app.useGlobalGuard(...guards)`

Add global guards that run before every route handler.

### `app.useGlobalFilter(...filters)`

Add global exception filters. They run after method- and class-level filters.

### `app.listen(port, callback?)`

Registers all controllers, calls `onInit()` on lifecycle-aware instances, then starts the server.

### `app.close()`

Calls `onDestroy()` on all tracked instances, then shuts down the adapter.

### `app.getAdapter()`

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

// Global
app.useGlobalGuard(authGuard);

// Controller-level
@UseGuard(authGuard)
@Controller("/admin")
class AdminController {
  /* ... */
}

// Method-level
class UserController {
  @UseGuard(authGuard)
  @Delete("/:id")
  delete(ctx: HttpContext) {
    /* ... */
  }
}
```

Guards run after middleware and before the route handler.

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
  InternalServerErrorException, // 500
} from "@decorify/core";

throw new NotFoundException("User not found");
throw new BadRequestException("Invalid input", { field: "email" });
```

### `DefaultExceptionFilter`

Handles `HttpException` instances automatically. For unknown errors it logs and returns a 500 response.

```ts
import { DefaultExceptionFilter } from "@decorify/core";

app.useGlobalFilter(new DefaultExceptionFilter());
```

### Custom filter

```ts
import type { ExceptionFilter, HttpContext } from "@decorify/core";

class ValidationFilter implements ExceptionFilter {
  catch(error: Error, ctx: HttpContext): void {
    ctx.status(422).json({ message: error.message });
  }
}

// Apply at class or method level
@UseFilter(new ValidationFilter())
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

- `onInit()` — called after `app.register()`, before `listen()` starts accepting requests
- `onDestroy()` — called when `app.close()` is invoked; runs in reverse registration order

## HttpContext API

Every route handler receives an `HttpContext`:

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

Implement `HttpAdapter` to integrate with any HTTP framework:

```ts
import type {
  HttpAdapter,
  RouteHandler,
  MiddlewareHandler,
  ErrorHandler,
} from "@decorify/core";

export class MyAdapter implements HttpAdapter {
  registerRoute(method: string, path: string, handler: RouteHandler): void {
    // Register route with your framework
  }

  useMiddleware(handler: MiddlewareHandler): void {
    // Register global middleware
  }

  useErrorHandler(handler: ErrorHandler): void {
    // Register global error handler
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
  container,
  Container,
} from "@decorify/core";
import type {
  Token,
  Lifetime,
  Constructor,
  AsyncInitializable,
} from "@decorify/core";
```

See the [`@decorify/di` README](../di/README.md) for full DI documentation.

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)
