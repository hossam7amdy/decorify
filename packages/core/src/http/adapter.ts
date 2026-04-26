import type { HttpContext } from "./context.ts";

export type Handler = (ctx: HttpContext) => Promise<unknown> | unknown;

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

export interface RouteDefinition {
  method: HttpMethod;
  path: string; // framework-normalized (`:param` style)
  handler: Handler;
}

export interface HttpAdapter<TNative = unknown> {
  /**
   * Register a route handler.
   *
   * **Must be callable before `listen()` is invoked.** Frameworks that lock
   * their routing table at startup (e.g. Fastify) should buffer routes
   * internally and flush them inside `listen()`.
   *
   * The adapter is responsible for catching any error thrown or rejected by
   * `handler` and rendering it as a `5xx` response. Use a try/catch around
   * `await Promise.resolve(handler(ctx))` inside the registered route.
   */
  registerRoute(route: RouteDefinition): void;

  /**
   * Start listening on `port` (and optional `host`).
   *
   * Pass `0` to let the OS assign a free port.
   * **Must return the actual bound port** — this is required for ephemeral
   * port usage in tests and integration environments.
   */
  listen(port: number, host?: string): Promise<number>;

  /**
   * Gracefully shut down the server.
   *
   * After `close()` resolves, the server must stop accepting new connections.
   * In-flight requests may be allowed to finish.
   */
  close(): Promise<void>;

  /**
   * Native server/application instance.
   *
   * Escape hatch for operations the `HttpAdapter` interface does not cover
   * (WebSocket upgrades, native middleware, custom routing).
   * Must never be `null` or `undefined`.
   */
  readonly native: TNative;
}
