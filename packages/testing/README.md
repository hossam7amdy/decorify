# Adapter Conformance Suite

`@decorify/testing` ships a conformance suite that verifies an `HttpAdapter` implementation satisfies the full `HttpContext` contract.

## Quick Start

The suite is runner-agnostic. Pass `{ describe, it, expect }` from any test framework.

### With `node:test` (built-in, no extra deps)

```ts
// packages/adapters/my-framework/test/adapter-conformance.test.ts
import { suite, it } from "node:test";
import assert from "node:assert/strict";
import { MyAdapter } from "../src/adapter.ts";
import { runAdapterConformance } from "@decorify/testing";
import type { ConformanceTestRunner } from "@decorify/testing";

const describe: ConformanceTestRunner["describe"] = (label, fn) =>
  suite(label, { concurrency: true, timeout: 500 }, fn);

const expect: ConformanceTestRunner["expect"] = (actual: any) => ({
  toBe: (expected) => assert.strictEqual(actual, expected),
  toEqual: (expected) => assert.deepStrictEqual(actual, expected),
  toContain: (expected) => assert.ok(actual.includes(expected)),
  toMatch: (pattern) =>
    typeof pattern === "string"
      ? assert.ok(String(actual).includes(pattern))
      : assert.match(String(actual), pattern),
  toBeGreaterThanOrEqual: (n) => assert.ok(actual >= n),
  toBeLessThan: (n) => assert.ok(actual < n),
  toBeDefined: () => assert.notStrictEqual(actual, undefined),
  toBeUndefined: () => assert.strictEqual(actual, undefined),
  not: { toBeNull: () => assert.notStrictEqual(actual, null) },
  rejects: {
    toThrow: async () =>
      assert.rejects(async () =>
        typeof actual === "function" ? await actual() : await actual,
      ),
  },
});

runAdapterConformance({
  name: MyAdapter.name,
  makeAdapter: () => new MyAdapter(),
  runner: { describe, it, expect },
});
```

Run:

```bash
node --test
```

### With vitest

```ts
import { describe, it, expect } from "vitest";
import { MyAdapter } from "../src/adapter.ts";
import { runAdapterConformance } from "@decorify/testing";

runAdapterConformance({
  name: MyAdapter.name,
  makeAdapter: () => new MyAdapter(),
  runner: { describe, it, expect },
});
```

Run:

```bash
pnpm vitest run
```

### With Jest

```ts
import { describe, it, expect } from "@jest/globals";
import { runAdapterConformance } from "@decorify/testing";

runAdapterConformance({ ..., runner: { describe, it, expect } });
```

## Options

```ts
interface AdapterConformanceOptions<TAdapter> {
  /** Display name shown in test output. */
  name: string;

  /**
   * Factory for a fresh adapter instance.
   * May be async — useful for adapters that need async initialization.
   */
  makeAdapter: () => TAdapter | Promise<TAdapter>;

  /**
   * Test runner functions. Pass `{ describe, it, expect }` from your test framework.
   * Both vitest and Jest satisfy the ConformanceTestRunner interface.
   */
  runner: ConformanceTestRunner;

  /**
   * Host to bind to and use in request URLs.
   * Default: "127.0.0.1"
   * Change this if your adapter binds to a specific host by default.
   */
  host?: string;

  /**
   * Maximum JSON payload the adapter accepts, in bytes.
   * Default: 100_000 (100 kb)
   * The oversized-body test sends 2 × bodyLimit bytes and expects a 4xx response.
   * Set this to your adapter's actual limit.
   */
  bodyLimit?: number;
}
```

## The Contract

Each test group below describes a contract your adapter must satisfy.

### Route Registration

- Routes registered via `registerRoute` must be served after `listen()`.
- `registerRoute` must be callable **before** `listen()` is called. Some frameworks (e.g. Fastify) lock their routing table once the server starts — buffer routes internally if needed.
- Unregistered paths must respond with `404`.
- Path parameters use Express-style colon syntax (`:id`). The adapter must parse them and populate `ctx.req.params`.
- `ctx.req.params` must be `{}` (not `undefined`) for routes with no path parameters.

### HTTP Methods

All of `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`, `HEAD` must be routable.

### HttpRequest Contract

| Property / Method | Contract                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `req.method`      | Uppercase HTTP verb: `"GET"`, `"POST"`, etc.                                                                                   |
| `req.path`        | Path only — no query string.                                                                                                   |
| `req.url`         | Full URL including query string.                                                                                               |
| `req.query`       | Parsed query string. Repeated keys (`?a=1&a=2`) must yield an array (`["1","2"]`).                                             |
| `req.headers`     | All headers accessible via lowercase key.                                                                                      |
| `req.params`      | Route path parameters as `Record<string, string>`. Empty object `{}` when none.                                                |
| `req.body()`      | Returns parsed JSON when `Content-Type: application/json`. Must be memoized — repeated calls return the same object reference. |

**Body parsing responsibility:** the adapter is responsible for parsing the request body. For JSON, parse based on the `Content-Type` header. For a plain `node:http` adapter, use a streaming reader; for Koa, install `koa-bodyparser`; for Fastify, it's built in.

**Oversized body:** when the payload exceeds your adapter's limit, respond with a `4xx` status code (typically `413 Payload Too Large`). Do not let the error surface as a `5xx`.

### HttpResponse Contract

| Method                     | Contract                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `res.json(data)`           | Serialize `data` as JSON; set `Content-Type: application/json`; set `sent = true`.   |
| `res.send(body)`           | Send string/Buffer body; set a `text/*` Content-Type; set `sent = true`.             |
| `res.end()`                | Terminate with no body; set `sent = true`.                                           |
| `res.status(code)`         | Set the response status code; returns `this` for chaining.                           |
| `res.header(name, value)`  | Set a response header; returns `this` for chaining.                                  |
| `res.redirect(url, code?)` | Redirect with a `Location` header; default code `302`.                               |
| `res.sent`                 | `false` before any of the above; `true` immediately after any of the above resolves. |

**Double-send guard (required):** once `sent === true`, further calls to `json`/`send`/`end`/`redirect` must be silent no-ops. They must not throw. Guard using the framework's "headers sent" flag (e.g. `res.headersSent` in Express/node:http).

### Error Propagation Contract

**Adapters must catch handler throws and render them as `5xx` responses.** The framework layer will not do this — it sits above the adapter. In practice, wrap every `handler(ctx)` call in try/catch inside `registerRoute`:

```ts
registerRoute(route: RouteDefinition): void {
  this.app.get(route.path, async (req, res) => {
    const ctx = buildContext(req, res);
    try {
      await Promise.resolve(route.handler(ctx));
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: String(err) });
      }
    }
  });
}
```

### HttpContext Contract

- `ctx.req.native` — the underlying framework request object (never `null` or `undefined`).
- `ctx.res.native` — the underlying framework response object (never `null` or `undefined`).
- `ctx.state` — a fresh `Record<string, unknown>` for every request. Must not be shared across requests.

### Server Lifecycle

- `listen(port, host?)` — start listening; return the actual bound port (important when `port = 0`).
- `close()` — stop accepting new connections; further requests must be rejected.

## Framework-Specific Notes

### Express

Works out of the box. Register routes before or after `listen()` (Express's router allows both). JSON body parsing requires `express.json()` middleware.

```ts
runAdapterConformance({
  name: "ExpressAdapter",
  makeAdapter: () => new ExpressAdapter(), // jsonLimit defaults to "100kb"
  runner: { describe, it, expect },
});
```

### Fastify

**Register routes before `listen()`.** Fastify locks its routing table at startup. Buffer routes in `registerRoute` and flush them in `listen()`:

```ts
class FastifyAdapter implements HttpAdapter {
  #pendingRoutes: RouteDefinition[] = [];
  #server = Fastify();

  registerRoute(route: RouteDefinition): void {
    this.#pendingRoutes.push(route);
  }

  async listen(port: number, host = "127.0.0.1"): Promise<number> {
    for (const route of this.#pendingRoutes) {
      this.#server.route({ method: route.method, url: route.path, handler: ... });
    }
    await this.#server.listen({ port, host });
    return (this.#server.server.address() as AddressInfo).port;
  }
}
```

Conformance options: set `bodyLimit` to match your Fastify `bodyLimit` config (default 1 MB = `1_048_576`).

### Koa

Install `koa-bodyparser` for JSON body support. Koa does not auto-render errors as 500 — add error handling in `registerRoute`.

### `node:http` (raw)

Requires manual: routing (path-to-regexp), JSON body parsing, error rendering, query parsing. See `test/__fixtures__/node-http-adapter.ts` for a reference implementation used in the portability tests.
