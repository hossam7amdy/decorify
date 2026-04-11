import type {
  RouteHandler,
  ErrorHandler,
  MiddlewareHandler,
} from "../types.js";

export interface HttpAdapter<Adapter = any> {
  /** Register a route handler with the underlying framework */
  registerRoute(method: string, path: string, handler: RouteHandler): void;

  /** Register a global middleware */
  useMiddleware(handler: MiddlewareHandler): void;

  /** Register a global error handler */
  useErrorHandler(handler: ErrorHandler): void;

  /** Start listening on a port */
  listen(port: number, callback?: () => void): Promise<void>;

  /** Graceful shutdown */
  close(): Promise<void>;

  /** Get the underlying framework instance */
  getInstance(): Adapter;
}
