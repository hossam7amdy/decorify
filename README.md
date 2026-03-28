# Decorify

A framework-agnostic micro-framework for building production-ready HTTP backends using **Stage 3 ES Decorators** (no `experimentalDecorators` required).

## Features

- **Stage 3 ES Decorators** — uses the TC39 standard, not the legacy TypeScript experimental decorators
- **Framework-agnostic** — pluggable adapter system; ships with an Express 5 adapter
- **Dependency Injection** — lightweight IoC container with `@Injectable`, `inject()`, and `@Inject`
- **Routing** — `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`
- **Middleware & Guards** — `@UseMiddleware`, `@UseGuard` at class or method level
- **Exception Filters** — `@UseFilter` and built-in `HttpException` subclasses
- **Lifecycle Hooks** — `OnInit` / `OnDestroy` interfaces called on startup and shutdown

## Installation

```bash
pnpm add decorify
# Express adapter (optional peer dependency)
pnpm add express
```

## Quick Start

```ts
// main.ts
import { Application } from "decorify";
import { ExpressAdapter } from "decorify/adapters";
import { UserController } from "./user.module/user.controller.js";

const app = new Application(new ExpressAdapter());

app.register([UserController]);

await app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
```

## Routing

Use `@Controller` to define a base path and HTTP method decorators on methods:

```ts
import { Controller, Get, Post } from "decorify";
import type { HttpContext } from "decorify";

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

Register classes with `@Injectable()` and resolve dependencies using `inject()` or the `@Inject` field decorator:

```ts
import { Injectable, inject, Inject } from "decorify";

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
  // decorator-based injection
  @Inject(UserService) private service!: UserService;
}
```

## Middleware & Guards

Apply middleware or guards globally, at the controller level, or per-route:

```ts
import { Application, UseMiddleware, UseGuard } from "decorify";
import type { HttpContext, Guard } from "decorify";

const logger: MiddlewareHandler = async (ctx, next) => {
  console.log(`${ctx.method.toUpperCase()} ${ctx.path}`);
  await next();
};

const authGuard: Guard = async (ctx) => {
  return ctx.headers.authorization === "Bearer secret";
};

// Global
app.useMiddleware(logger);
app.useGlobalGuard(authGuard);

// Controller-level
@UseMiddleware(logger)
@UseGuard(authGuard)
@Controller("/admin")
class AdminController {
  /* ... */
}

// Method-level
class PostController {
  @UseGuard(authGuard)
  @Delete("/:id")
  delete(ctx: HttpContext) {
    /* ... */
  }
}
```

## Exception Handling

Throw built-in exceptions in handlers or guards; catch them with `@UseFilter`:

```ts
import {
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  InternalServerErrorException,
  DefaultExceptionFilter,
  UseFilter,
} from "decorify";

// Throw anywhere in a handler
throw new NotFoundException("User not found");

// Apply globally
app.useGlobalFilter(new DefaultExceptionFilter());

// Or per controller / method
@UseFilter(new DefaultExceptionFilter())
@Controller("/users")
class UserController {
  /* ... */
}
```

### Custom Exception Filter

```ts
import type { ExceptionFilter, HttpContext } from "decorify";

class MyFilter implements ExceptionFilter {
  canCatch(error: unknown): boolean {
    return error instanceof MyCustomError;
  }

  catch(error: unknown, ctx: HttpContext): void {
    ctx.status(422).json({ message: (error as MyCustomError).message });
  }
}
```

## Lifecycle Hooks

Implement `OnInit` or `OnDestroy` on any `@Injectable` class:

```ts
import type { OnInit, OnDestroy } from "decorify";

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
} from "decorify";

export class MyAdapter implements HttpAdapter {
  addRoute(method: string, path: string, handler: RouteHandler): void {
    /* ... */
  }
  use(middleware: MiddlewareHandler): void {
    /* ... */
  }
  listen(port: number, callback?: () => void): Promise<void> {
    /* ... */
  }
  close(): Promise<void> {
    /* ... */
  }
}
```

## Project Structure

```
src/
├── application.ts          # Application bootstrap class
├── router.ts               # Controller registration & route pipeline builder
├── context.ts              # HttpContext interface
├── types.ts                # Shared types (Guard, ExceptionFilter, etc.)
├── adapters/
│   ├── http-adapter.ts     # HttpAdapter interface
│   └── express/            # Express 5 adapter
├── di/                     # IoC container + @Injectable / inject / @Inject
├── http/                   # @Controller, @Get/@Post/… , @UseMiddleware, @UseGuard, @UseFilter
├── errors/                 # HttpException subclasses + DefaultExceptionFilter
└── lifecycle/              # OnInit / OnDestroy interfaces + LifecycleManager
```

## License

ISC © [Hossam Hamdy](mailto:hossamhamdy117@gmail.com)
