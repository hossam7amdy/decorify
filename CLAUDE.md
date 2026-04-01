# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Decorify is a framework-agnostic micro-framework for building HTTP backends using **Stage 3 ES Decorators** (TC39 standard, not legacy `experimentalDecorators`). It is a **pnpm workspace monorepo** with 3 packages:

- **`@decorify/di`** (`packages/di/`) — standalone IoC container, zero framework dependencies
- **`@decorify/core`** (`packages/core/`) — HTTP framework (routing, middleware, guards, filters, lifecycle hooks); depends on `@decorify/di`
- **`@decorify/express-adapter`** (`packages/express-adapter/`) — Express 5 adapter; depends on `@decorify/core`

## Commands

### Root workspace (runs across all packages)

- **Install:** `pnpm install` (enforced via `only-allow pnpm`)
- **Build all:** `pnpm build` (builds packages in dependency order: di → core → express-adapter)
- **Test all:** `pnpm test` (vitest projects mode, runs all package test suites)
- **Test watch:** `pnpm test:watch`
- **Test coverage:** `pnpm test:coverage`
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
├── vitest.config.ts          ← root vitest config (projects mode)
├── packages/
│   ├── di/src/
│   │   ├── types.ts          ← DI types: Constructor, Token, Provider, ClassProvider, ValueProvider, FactoryProvider, ExistingProvider
│   │   ├── lifetime.ts       ← Lifetime enum (SINGLETON, TRANSIENT, SCOPED)
│   │   ├── injection-token.ts ← InjectionToken class
│   │   ├── metadata.ts       ← DI metadata keys (DI_INJECTABLE, DI_INJECT_TOKENS, DI_SCOPE)
│   │   ├── context.ts        ← InjectionContext, injectionContext (AsyncLocalStorage), inject()
│   │   ├── symbol-metadata-polyfill.ts
│   │   ├── container.ts      ← Container class
│   │   ├── decorators.ts     ← @Injectable, @Inject
│   │   └── index.ts
│   ├── core/src/
│   │   ├── types.ts          ← HTTP types: RouteHandler, MiddlewareHandler, Guard, ExceptionFilter
│   │   ├── context.ts        ← HttpContext interface
│   │   ├── http/             ← @Controller, @Get/@Post/..., @UseMiddleware/@UseGuard/@UseFilter
│   │   ├── errors/           ← HttpException subclasses, DefaultExceptionFilter
│   │   ├── lifecycle/        ← OnInit/OnDestroy interfaces, LifecycleManager
│   │   ├── adapters/         ← HttpAdapter interface
│   │   ├── router.ts         ← registerControllers(), buildPipeline()
│   │   ├── application.ts    ← Application class
│   │   └── index.ts          ← re-exports everything including @decorify/di
│   └── express-adapter/src/
│       └── index.ts          ← ExpressAdapter implements HttpAdapter
```

### Decorator Metadata System

All decorators use the **Stage 3 `Symbol.metadata`** API. A polyfill in `packages/di/src/symbol-metadata-polyfill.ts` ensures `Symbol.metadata` exists at runtime. It is imported as a side-effect from `@decorify/di`'s entry point. Tests load it via vitest `setupFiles`.

### Request Pipeline (`packages/core/src/router.ts`)

Each route builds a pipeline: **guards → middleware chain (Koa-style onion) → handler**. Errors are caught and passed through exception filters in order: method-level → class-level → global → DefaultExceptionFilter. Routes are sorted so static paths register before parameterized ones.

### Dependency Injection (`packages/di/`)

`Container` class (instantiate directly; no global instance exported). `@Injectable()` registers a class and supports an optional `{ lifetime }` option. Resolution is lazy — instances are created on first `resolve()` call. Two injection styles: `inject(Token)` (functional, via `context.ts`) and `@Inject(Token)` (field decorator). The container uses `AsyncLocalStorage` (`injectionContext`) to propagate the resolution context. Lifetimes: `Lifetime.SINGLETON` (default), `Lifetime.TRANSIENT`, `Lifetime.SCOPED`. Scoped containers are created with `createScope()`. Async factories are not supported — factories must return synchronously.

### Adapter Pattern

`HttpAdapter` interface lives in `@decorify/core`. `ExpressAdapter` in `@decorify/express-adapter` wraps Express 5, translating between Express req/res and `HttpContext`. Custom adapters implement `registerRoute`, `useMiddleware`, `listen`, and `close`.

### Lifecycle (`packages/core/src/lifecycle/`)

`LifecycleManager` tracks resolved controller instances. `onInit()` is called after registration but before `listen()`. `onDestroy()` is called on `app.close()`.

## Key Conventions

- ESM-only (`"type": "module"`). All internal imports use `.js` extensions.
- `experimentalDecorators: false` and `emitDecoratorMetadata: false` — this project explicitly uses Stage 3 decorators.
- Each package has its own `tsconfig.json` extending `../../tsconfig.base.json`, with `composite: true` for project references.
- Tests use vitest with SWC for decorator transpilation (`decoratorVersion: "2023-11"`). Test files are colocated as `*.test.ts` next to source files.
- Node >= 22 required.
- Express 5 is a peer dependency of `@decorify/express-adapter` only.
