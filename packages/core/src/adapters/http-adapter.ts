import type {
  RouteHandler,
  ErrorHandler,
  MiddlewareHandler,
} from "../types.js";

/**
 * Interface for module augmentation.
 * Implementers can extend this interface to provide strong typing for the underlying adapter.
 *
 * @example
 * declare module '@decorify/core' {
 *   interface InjectableAdapter extends Express {}
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InjectableAdapter {}

export type ResolvedAdapter<T = any> = keyof InjectableAdapter extends never
  ? T
  : InjectableAdapter;

export interface HttpAdapter<Adapter = ResolvedAdapter> {
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
