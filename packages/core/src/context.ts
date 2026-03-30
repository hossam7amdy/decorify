export interface HttpContext {
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

  /** Access to raw framework-specific objects (escape hatch) */
  readonly raw: { req: unknown; res: unknown };
}
