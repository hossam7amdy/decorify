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
  /** Register a route handler with the underlying framework */
  registerRoute(route: RouteDefinition): void;

  /** Start listening on a port */
  listen(port: number, host?: string): Promise<void>;

  /** Graceful shutdown */
  close(): Promise<void>;

  /** Native server instance — for websocket upgrades, native middleware, custom routing. */
  readonly native: TNative;
}
