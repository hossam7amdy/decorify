# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Decorify is a framework-agnostic micro-framework for building HTTP backends using **Stage 3 ES Decorators** (TC39 standard, not legacy `experimentalDecorators`). It ships with an Express 5 adapter and features DI, routing, middleware, guards, exception filters, and lifecycle hooks.

## Commands

- **Install:** `pnpm install` (enforced via `only-allow pnpm`)
- **Build:** `pnpm build` (runs `tsc --build`)
- **Test:** `pnpm test` (vitest run)
- **Test single file:** `pnpm exec vitest run src/di/container.test.ts`
- **Test watch:** `pnpm test:watch`
- **Test coverage:** `pnpm test:coverage`
- **Format check:** `pnpm format` (prettier)

## Architecture

### Decorator Metadata System

All decorators use the **Stage 3 `Symbol.metadata`** API — metadata is stored on `context.metadata` (the class's `[Symbol.metadata]` object), not via `reflect-metadata`. A polyfill in `src/symbol-metadata-polyfill.ts` ensures `Symbol.metadata` exists at runtime. Tests load this polyfill via vitest `setupFiles`, and the main entry point imports it as a side effect.

### Request Pipeline (router.ts)

Each route builds a pipeline: **guards -> middleware chain (Koa-style onion) -> handler**. Errors are caught and passed through exception filters in order: method-level -> class-level -> global -> DefaultExceptionFilter. Routes are sorted so static paths register before parameterized ones.

### Dependency Injection (di/)

Singleton IoC container (`container` global instance). `@Injectable()` registers a class. Resolution is lazy — instances are created on first `resolve()` call. Two injection styles: `inject(Token)` (functional, in field initializers during construction) and `@Inject(Token)` (field decorator). The container tracks an `injectionContext` flag so `inject()` only works during resolution.

### Adapter Pattern (adapters/)

`HttpAdapter` is the abstraction layer. The Express adapter (`adapters/express/`) wraps Express 5, translating between Express req/res and the framework's `HttpContext` interface. Custom adapters implement `registerRoute`, `use`, `listen`, and `close`.

### Lifecycle (lifecycle/)

`LifecycleManager` tracks resolved controller instances. `onInit()` is called after registration but before `listen()`. `onDestroy()` is called on `app.close()`.

## Key Conventions

- ESM-only (`"type": "module"`). All internal imports use `.js` extensions.
- `experimentalDecorators: false` and `emitDecoratorMetadata: false` in tsconfig — this project explicitly uses Stage 3 decorators.
- Tests use vitest with SWC for decorator transpilation (`decoratorVersion: "2023-11"`). Test files are colocated as `*.test.ts` next to source files.
- Node >= 22 required.
- Express 5 is an optional peer dependency.
