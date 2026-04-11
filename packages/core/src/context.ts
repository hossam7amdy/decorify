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

export interface HttpContext extends InjectableContext {
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
  status(code: number): HttpContext;
  /** Send JSON response */
  json(data: unknown): void;
  /** Send text/html response */
  send(data: string | Buffer): void;
  /** Set a response header */
  setHeader(name: string, value: string): HttpContext;
  /** Redirect to a URL */
  redirect(url: string, statusCode?: number): void;
  /** Check if a response has already been sent */
  readonly responseSent: boolean;
}
