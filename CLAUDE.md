## Project Overview

Decorify is a framework-agnostic micro-framework for building HTTP backends using **Stage 3 ES Decorators** (TC39 standard, not legacy `experimentalDecorators`). It is a **pnpm workspace monorepo** with 5 packages:

- **`@decorify/di`** (`packages/di/`) — standalone IoC container, zero framework dependencies
- **`@decorify/core`** (`packages/core/`) — HTTP framework (modules, routing, unified middleware); depends on `@decorify/di`
- **`@decorify/testing`** (`packages/testing/`) — adapter conformance test suite; depends on `@decorify/core`
- **`@decorify/express`** (`packages/adapters/express/`) — Express 5 adapter; depends on `@decorify/core`
- **`@decorify/fastify`** (`packages/adapters/fastify/`) — Fastify 5 adapter; depends on `@decorify/core`

## Commands

### Root workspace (runs across all packages)

- **Install:** `pnpm install` (enforced via `only-allow pnpm`)
- **Build all:** `pnpm build` (builds packages in dependency order: di → core → express, testing & fastify)
- **Test all:** `pnpm test` (runs all package test suites)
- **Format check:** `pnpm format` (prettier)
- **Clean all:** `pnpm clean`

### Per-package (from repo root)

- **Build one:** `pnpm --filter @decorify/di build`
- **Test one:** `pnpm --filter @decorify/core test`
- **Test single file:** `pnpm --filter @decorify/di exec vitest run src/container.test.ts`

## Architecture

### Monorepo Structure

```
decorify/
├── tsconfig.base.json        ← shared TS compiler options
├── packages/
│   ├── di/src/
│   │   ├── types.ts          ← DI types: Constructor, Token, Provider, ClassProvider, ValueProvider, FactoryProvider, ExistingProvider
│   │   ├── lifetime.ts       ← Lifetime enum (SINGLETON, TRANSIENT, SCOPED)
│   │   ├── injection-token.ts ← InjectionToken class
│   │   ├── metadata.ts       ← DI metadata keys (DI_INJECTABLE, DI_INJECT_TOKENS, DI_LIFETIME)
│   │   ├── context.ts        ← InjectionContext, injectionContext (AsyncLocalStorage), inject()
│   │   ├── symbol-metadata-polyfill.ts
│   │   ├── container.ts      ← Container class
│   │   ├── decorators.ts     ← @Injectable, @Inject
│   │   └── index.ts
│   ├── core/src/
│   │   ├── module.ts         ← ModuleDefinition interface, defineModule()
│   │   ├── middleware.ts     ← Middleware type, compose() (Koa-style onion)
│   │   ├── decorators/       ← @Controller, @Get/@Post/..., @UseMiddleware
│   │   ├── http/             ← HttpContext, HttpRequest, HttpResponse, HttpAdapter, HttpStatus
│   │   ├── errors/           ← HttpException subclasses, defaultErrorHandler
│   │   ├── application.ts    ← Application class (static async create() factory, private constructor)
│   │   └── index.ts          ← re-exports everything including @decorify/di
│   ├── testing/src/
│   │   └── adapter-conformance.ts ← runAdapterConformance() suite
│   └── adapters/
│       ├── express/src/
│       │   └── index.ts      ← ExpressAdapter implements HttpAdapter
│       └── fastify/src/
│           └── index.ts      ← FastifyAdapter implements HttpAdapter
```

### Decorator Metadata System

All decorators use the **Stage 3 `Symbol.metadata`** API. A polyfill in `packages/di/src/symbol-metadata-polyfill.ts` ensures `Symbol.metadata` exists at runtime. It is imported as a side-effect from `@decorify/di`'s entry point. Tests load it via vitest `setupFiles`.

### Module System (`packages/core/src/module.ts`)

Modules are flat organizational units defined via `defineModule({ name, providers?, controllers?, middlewares? })`. No `imports`/`exports`/isolation — all providers land in one root `Container`. Module-level `middlewares` apply to that module's controllers only. `Application.create({ adapter, modules, globalMiddleware?, errorHandler? })` is the entry point.

### Request Pipeline (`packages/core/src/middleware.ts`, `application.ts`)

Each route composes a middleware chain at boot: **global → module → controller → route middleware → handler**. Middleware is Koa-style onion (`(ctx, next) => ...`). Guards, interceptors, and filters are all expressed as middleware. Errors are caught by the route handler and passed to the `errorHandler` (defaults to `defaultErrorHandler`).

### Response Convention

| Handler action                       | Framework behavior                         |
| ------------------------------------ | ------------------------------------------ |
| Returns a value, doesn't touch `res` | Auto-encodes via `ctx.res.json(result)`    |
| Uses `ctx.res.*` (`sent=true`)       | Framework skips auto-encode                |
| Returns nothing, doesn't touch `res` | Sends `204 No Content` via `ctx.res.end()` |

### Dependency Injection (`packages/di/`)

`Container` class (instantiate directly; no global instance exported). `@Injectable()` registers a class and supports an optional `{ lifetime }` option. Resolution is lazy — instances are created on first `resolve()` call. Two injection styles: `inject(Token)` (functional, via `context.ts`) and `@Inject(Token)` (field decorator). The container uses `AsyncLocalStorage` (`injectionContext`) to propagate the resolution context. Lifetimes: `Lifetime.SINGLETON` (default), `Lifetime.TRANSIENT`, `Lifetime.SCOPED`. Scoped containers are created with `createScope()`. Async factories are supported via `container.resolveAsync(token)` — `FactoryProvider.useFactory` may return `T | Promise<T>`. The sync `resolve()` still throws if a factory returns a Promise. Resolved async singletons are cached and subsequently available via sync `resolve()`.

### HttpContext (`packages/core/src/http/context.ts`)

`HttpContext<TReq, TRes>` is generic over native request/response types. Contains `req` (HttpRequest), `res` (HttpResponse), and `state` (per-request `Record<string, unknown>` — never shared across requests). `req.native` and `res.native` expose the underlying framework objects. `req.body()` is **memoized** per request — repeated calls return the same object reference. Each adapter exports a typed alias (e.g., `ExpressContext = HttpContext<Request, Response>`, `FastifyContext = HttpContext<FastifyRequest, FastifyReply>`).

### Adapter Pattern

`HttpAdapter<TNative>` interface lives in `@decorify/core`. Methods: `registerRoute(route)`, `listen(port, host?) => Promise<number>` (returns actual bound port), `close()`, `readonly native`. `ExpressAdapter` in `@decorify/express` wraps Express 5; `FastifyAdapter` in `@decorify/fastify` wraps Fastify 5 — both translate between their native req/res and `HttpContext`. No `useMiddleware` on the adapter — use `adapter.native.use()` (Express) or `adapter.native.register()` (Fastify) for native middleware.

**Fastify-specific:** Fastify locks its routing table at startup. `FastifyAdapter` buffers routes registered before `listen()` and flushes them during startup — adapters calling `registerRoute()` after `listen()` will throw. The `FastifyAdapterOptions` supports `instance` (bring your own Fastify instance) and `bodyLimit` (default `100_000` bytes / 100 kb).

### Lifecycle

No lifecycle hook interfaces (v1). `container.initialize()` is called during `Application.create()` for eager singleton resolution. `container.dispose()` runs `Symbol.asyncDispose` on instances during `app.close()`. Wire `app.close()` to SIGTERM.

## Key Conventions

- ESM-only (`"type": "module"`). All internal imports use `.ts` extensions (with `rewriteRelativeImportExtensions: true` in tsconfig).
- `experimentalDecorators: false` and `emitDecoratorMetadata: false` — this project explicitly uses Stage 3 decorators.
- Each package has its own `tsconfig.json` extending `../../tsconfig.base.json`, with `composite: true` for project references.
- Tests use vitest with SWC for decorator transpilation (`decoratorVersion: "2023-11"`). The `testing` package itself uses the Node.js built-in test runner (`node:test`) via `node --experimental-strip-types --test`. Test files in other packages are colocated as `*.test.ts` next to source files.
- Node >= 22 required (>= 22.18 for `@decorify/testing` which uses `--experimental-strip-types`).
- Express 5 is a peer dependency of `@decorify/express` only. Fastify 5 is a peer dependency of `@decorify/fastify` only.
