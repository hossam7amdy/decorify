/**
 * Interface for module augmentation.
 * Implementers can extend this interface to provide strong typing for the underlying raw context.
 *
 * @example
 * declare module '@decorify/core' {
 *   interface InjectableContext extends Request {}
 * }
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface InjectableContext {}

export type ResolvedContext<T = any> = keyof InjectableContext extends never
  ? T
  : InjectableContext;

export interface HttpContext<Context = ResolvedContext> {
  /** HTTP method (lowercase) */
  readonly method: string;
  /** Request path */
  readonly path: string;
  /** Parsed URL params (e.g., :id) */
  readonly params: Record<string, string>;
  /** Query string parameters */
  readonly query: Record<string, string | string[] | undefined>;
  /** Request headers */
  readonly headers: Record<string, string | string[] | undefined>;
  /** Parsed request body */
  readonly body: unknown;

  /** Set response status code */
  status(code: number): HttpContext<Context>;
  /** Send JSON response */
  json(data: unknown): void;
  /** Send text/html response */
  send(data: string | Buffer): void;
  /** Set a response header */
  setHeader(name: string, value: string): HttpContext<Context>;

  /** Access to raw framework-specific context */
  readonly raw: Context;
}
