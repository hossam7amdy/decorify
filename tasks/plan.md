# Implementation Plan: Portable Adapter Conformance Suite

## Overview

Refactor `packages/core/src/testing/adapter-conformance.ts` so any Node.js HTTP adapter author (Koa, Fastify, Hono, raw `node:http`, Bun-on-Node, etc.) can drop a one-liner `runAdapterConformance({ name, makeAdapter })` into their test file and validate compliance with the `HttpAdapter` / `HttpContext` contract — not just Express.

The current suite was written against Express 5 and silently bakes in Express-specific assumptions (route registration after `listen`, body pre-parsed by middleware, framework auto-renders 500 on throw, default host `0.0.0.0`, `100kb` body limit). Those assumptions block Fastify (locks routing post-listen), `node:http` (no error rendering), and any adapter with a different default body limit.

This plan refactors the suite around a `withAdapter(routes, fn)` helper that builds, registers, listens, runs, and closes — making each test self-contained and lifecycle-correct. It also makes parameters configurable (body limit, host), tightens contract docs, and proves portability by smoke-testing against a second adapter.

## Architecture Decisions

- **`withAdapter` helper, not `beforeEach` adapter.** Per-test fresh adapter instance avoids cross-test state and makes `register-then-listen` ordering enforceable. Closes the Fastify-incompatibility hole.
- **`makeAdapter` becomes `() => TAdapter | Promise<TAdapter>`.** Frameworks needing async setup (Hono with bindings, Fastify plugin chains) shouldn't be locked out.
- **Conformance-suite options carry capability hints, not feature flags.** `bodyLimit?: number`, `host?: string` describe what the adapter _is_; suite adapts. Keeps tests behavior-driven, not opt-out-driven.
- **Keep vitest-coupled for v1.** Splitting into pure-assertion functions + runner adapter is bigger work; defer. Document vitest as the supported runner; decouple in a follow-up.
- **Contract docs live next to suite.** `packages/core/src/testing/README.md` becomes the authoritative adapter contract — explains what each conformance test enforces and what the adapter author must do to satisfy it.
- **Suite stays in `@decorify/core/testing`.** Already exported, already package-published; don't move it.

## Task List

### Phase 1: Lifecycle & API Ergonomics (breaking signature changes)

- [ ] **Task 1:** Introduce `withAdapter` helper and invert lifecycle to _register-then-listen_
- [ ] **Task 2:** Allow async `makeAdapter` and add optional `host` / `bodyLimit` options

### Checkpoint: Phase 1

- [ ] `pnpm --filter @decorify/express test` passes (Express still conforms after refactor)
- [ ] `pnpm build` clean across all packages
- [ ] No `beforeEach`/`afterEach` adapter creation remains

### Phase 2: Test Correctness Fixes

- [ ] **Task 3:** Make `ctx.state` test actually prove per-request isolation (concurrent fetches)
- [ ] **Task 4:** Lift native-handle assertion from inside handler to test-side captured vars
- [ ] **Task 5:** Replace `res.send("")` in HEAD/OPTIONS rows with `res.end()`; tighten Method matrix
- [ ] **Task 6:** Add tests for paramless `req.params`, double-send guard, `res.send(string)` content-type contract
- [ ] **Task 7:** Make oversized-body test scale off `opts.bodyLimit` instead of hardcoded 2MB

### Checkpoint: Phase 2

- [ ] All conformance tests pass for Express
- [ ] Failure messages name the violated contract clearly (no opaque `expected 200 received 500`)

### Phase 3: Contract Documentation

- [ ] **Task 8:** Write `packages/core/src/testing/README.md` — adapter author guide + per-test contract reference
- [ ] **Task 9:** Tighten JSDoc on `HttpAdapter`, `HttpRequest.body()`, `HttpResponse.sent` in `packages/core/src/http/`

### Checkpoint: Phase 3

- [ ] README explains: route ordering, body parsing responsibility, error-rendering responsibility, native escape hatch
- [ ] JSDoc covers what conformance silently expects

### Phase 4: Portability Proof

- [ ] **Task 10:** Build a minimal `node:http` adapter (test-fixture only, not published) and run conformance against it; treat any failure as a contract or suite bug
- [ ] **Task 11:** Document any conformance gaps that surfaced and either fix the suite or add a documented exception

### Checkpoint: Phase 4 (Complete)

- [ ] Two independent adapters pass the same suite
- [ ] All Critical/Important findings from prior review are addressed
- [ ] PR-ready

## Risks and Mitigations

| Risk                                                            | Impact | Mitigation                                                                                |
| --------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| Refactoring suite breaks the Express adapter test silently      | High   | Run `pnpm --filter @decorify/express test` after every task in Phase 1                    |
| `withAdapter` per-test creates noticeable test-time regression  | Med    | Measure before/after; if >2× slowdown, share adapter inside an `it.each` block where safe |
| `bodyLimit` option leaks adapter-internal knobs into suite API  | Med    | Document as "the maximum payload your adapter accepts" — semantic, not implementation     |
| `node:http` proof adapter (Task 10) becomes maintained code     | Med    | Keep under `packages/core/src/testing/__fixtures__/` clearly labeled as test-only         |
| Async `makeAdapter` change breaks Express test invocation       | Low    | One-line update at `packages/adapters/express/test/adapter-conformance.test.ts:6`         |
| Hardcoded `127.0.0.1` baseUrl mismatches default `0.0.0.0` bind | Low    | Already inconsistent today; Phase 1 fixes by passing host explicitly                      |

## Open Questions

- **Vitest coupling:** Should we decouple from vitest now (extract pure assertion functions, take `describe/it/expect` via injection) or defer to a v2? Current proposal: defer.
- **`stream(body)` from README:** README documents `ctx.res.stream(body)` but the `HttpResponse` interface in `context.ts:18` doesn't have it. Is this an interface gap or a doc bug? Out-of-scope for this plan but worth flagging.
- **`raw` field:** README mentions `ctx.raw` escape hatch but `HttpContext` has `req.native`/`res.native`, not `ctx.raw`. Doc drift; fix in Task 9.
- **Should conformance assert specific content-type strings (e.g. `text/plain` for `send(string)`), or just `text/*`?** Stricter = more portable test, less framework freedom. Leaning `text/*` (Important #11 from review).

## Files Likely Touched

- `packages/core/src/testing/adapter-conformance.ts` (refactor — most work)
- `packages/core/src/testing/index.ts` (re-exports if API surface changes)
- `packages/core/src/testing/README.md` (new)
- `packages/core/src/testing/__fixtures__/node-http-adapter.ts` (new, test-only)
- `packages/core/src/testing/node-http-adapter.test.ts` (new)
- `packages/core/src/http/adapter.ts` (JSDoc only)
- `packages/core/src/http/context.ts` (JSDoc only)
- `packages/adapters/express/test/adapter-conformance.test.ts` (update if signature changes)

## Out of Scope

- Decoupling suite from vitest (deferred — see Open Questions)
- Adding the missing `stream()` method to `HttpResponse` (separate concern)
- Fixing `ctx.raw` doc drift in core README beyond JSDoc updates
- Building published Koa/Fastify/Hono adapters (only the in-repo `node:http` proof)
