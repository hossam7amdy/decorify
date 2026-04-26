# Todo: Portable Adapter Conformance Suite

Companion to `tasks/plan.md`. Each task is self-contained: description, acceptance criteria, verification, dependencies, files, scope.

---

## Phase 1 — Lifecycle & API Ergonomics ✅

### Task 1: Introduce `withAdapter` helper; invert lifecycle to register-then-listen ✅

**Description:** Replace the `beforeEach` / `afterEach` adapter creation with a per-test `withAdapter(routes, fn)` helper that (1) calls `makeAdapter()`, (2) registers routes, (3) calls `listen(0, host)`, (4) invokes `fn(baseUrl)`, (5) closes the adapter in a `finally`. This unblocks Fastify-style adapters that lock routing after `listen` and removes the silent ordering assumption from the contract.

**Acceptance criteria:**

- [x] `runAdapterConformance` no longer uses module-level `beforeEach`/`afterEach` for adapter creation (Server Lifecycle describe block may keep its own).
- [x] Every conformance `it` registers its routes _before_ `listen` is called.
- [x] Adapter is closed even when the test assertion throws.
- [x] Each test gets a fresh `adapter` instance — no cross-test state.

**Verification:**

- [x] `pnpm --filter @decorify/express test` passes
- [x] `pnpm --filter @decorify/core test` passes
- [x] `pnpm build` succeeds

---

### Task 2: Allow async `makeAdapter`; add optional `host` and `bodyLimit` options ✅

**Description:** Widen `AdapterConformanceOptions` so adapters can:

1. Initialize asynchronously (`makeAdapter: () => TAdapter | Promise<TAdapter>`).
2. Declare their listen host (`host?: string`, default `"127.0.0.1"`) so `baseUrl` matches the actual bind.
3. Declare their max accepted JSON payload size (`bodyLimit?: number` in bytes, default `100_000`) so the oversized-body test scales correctly.

**Acceptance criteria:**

- [x] `withAdapter` awaits `makeAdapter()` (works for sync and async return).
- [x] `listen` is called with the configured host; `baseUrl` uses the same host.
- [x] `bodyLimit` is exposed on options and consumed by the oversized test.
- [x] Express test still works with no options changes (defaults match Express adapter's `100kb`).

---

### Checkpoint: Phase 1 Complete ✅

- [x] All Express conformance tests still pass (35/35)
- [x] No `beforeEach` adapter creation remains in main describes
- [x] Helper is documented inline (JSDoc)

---

## Phase 2 — Test Correctness Fixes ✅

### Task 3: Make `ctx.state` test prove per-request isolation ✅

**Acceptance criteria:**

- [x] Two concurrent requests with distinct identifiers; each sees its own value.
- [x] Small `setTimeout(r, 10)` delay to allow event loop interleaving.
- [x] Test name is `"ctx.state is isolated per request"`.

### Task 4: Lift native-handle assertion out of handler ✅

**Acceptance criteria:**

- [x] `reqNative`/`resNative` captured to outer-scope variables.
- [x] Assertions use `expect(reqNative).not.toBeNull()` etc. after fetch.
- [x] No handler-status encode trick.

### Task 5: Replace `send("")` with `end()` in HEAD/OPTIONS rows ✅

**Acceptance criteria:**

- [x] HEAD and OPTIONS handlers call `res.end()`.
- [x] HEAD test asserts empty body.

### Task 6: Add coverage for paramless `params`, double-send, and `send(string)` content-type ✅

**Acceptance criteria:**

- [x] Paramless params test: `ctx.req.params` equals `{}`.
- [x] Double-send test: second `res.json()` call does not throw.
- [x] `res.send(string)` content-type asserts `text/*`.

Also fixed: `build-context.ts` in Express adapter now guards against double-send with `if (res.headersSent) return;` on all response methods.

### Task 7: Scale oversized-body test off `opts.bodyLimit` ✅

**Acceptance criteria:**

- [x] Payload is `2 * bodyLimit` (default `2 × 100_000`).
- [x] Express adapter still passes.

---

### Checkpoint: Phase 2 Complete ✅

- [x] 35 conformance tests pass for Express
- [x] Failure messages are explicit (captured vars, not handler-status tricks)

---

## Phase 3 — Contract Documentation ✅

### Task 8: Write `packages/core/src/testing/README.md` ✅

**Acceptance criteria:**

- [x] README at `packages/core/src/testing/README.md`.
- [x] Every conformance test maps to a documented contract bullet.
- [x] Framework-specific notes for Express, Fastify (route buffering), Koa, `node:http`.

### Task 9: Tighten JSDoc on `HttpAdapter`, `HttpRequest.body`, `HttpResponse.sent` ✅

**Acceptance criteria:**

- [x] `adapter.ts` — contract for `registerRoute` (pre-listen + catch errors), `listen` (returns bound port), `close`, `native`.
- [x] `context.ts` — `body()` memoization, `sent` flip behavior, `state` isolation, `params` empty-object contract.
- [x] `pnpm build` succeeds.

---

### Checkpoint: Phase 3 Complete ✅

---

## Phase 4 — Portability Proof ✅

### Task 10: Add `node:http` test-fixture adapter and run conformance against it ✅

**Acceptance criteria:**

- [x] Fixture at `packages/core/src/testing/__fixtures__/node-http-adapter.ts`.
- [x] Implements: inline colon-param router, JSON body parsing, 100 kb limit → 413, error rendering, query parsing, headers normalization.
- [x] All 35 conformance tests pass.
- [x] Not exported from package entry points.

**Verification:**

- [x] `pnpm --filter @decorify/core test` → 91 tests pass (56 core + 35 conformance)
- [x] `pnpm build` succeeds

### Task 11: Resolve contract gaps surfaced by Task 10 ✅

**Gaps found and resolved:**

1. **Double-send guard:** `node:http` adapter's response methods guard with `if (res.headersSent) return;`. This surfaced that the Express `build-context.ts` was missing the same guard — fixed in that file too. Contract documented in `context.ts` JSDoc and README.

2. **No gaps required suite changes** — the suite was portable as written once lifecycle was fixed.

---

### Checkpoint: Complete ✅

- [x] All Critical and Important findings from prior review addressed
- [x] Two independent adapters (Express + `node:http`) pass the same 35-test suite
- [x] Contract documented in README + JSDoc
- [x] `pnpm test` (root) → di(106) + core(91) + express(35) = 232 tests, all pass
- [x] `pnpm build` (root) → clean
