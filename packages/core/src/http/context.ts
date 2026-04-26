export interface HttpContext<TReq = unknown, TRes = unknown> {
  readonly req: HttpRequest<TReq>;
  readonly res: HttpResponse<TRes>;
  /** Per-request mutable state bag. Must be a fresh `{}` for every request — never shared. */
  readonly state: Record<string, unknown>;
}

export interface HttpRequest<TNative = unknown> {
  /** Underlying framework request object. Never `null` or `undefined`. */
  readonly native: TNative;
  /** Uppercase HTTP method: `"GET"`, `"POST"`, etc. */
  readonly method: string;
  /** Request path, without query string. */
  readonly path: string;
  /** Full URL including query string. */
  readonly url: string;
  /** Request headers, accessible via lowercase key. */
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  /**
   * Parsed query string parameters.
   * Repeated keys (`?a=1&a=2`) yield an array: `{ a: ["1", "2"] }`.
   */
  readonly query: Readonly<Record<string, string | string[] | undefined>>;
  /**
   * Route path parameters (e.g. `/users/:id` → `{ id: "42" }`).
   * Must be `{}` (not `undefined`) when the route has no path parameters.
   */
  readonly params: Readonly<Record<string, string>>;
  /**
   * Returns the parsed request body.
   *
   * When `Content-Type: application/json`, must parse and return the JSON
   * object. **Must be memoized** — repeated calls must return the same object
   * reference without re-reading the stream.
   */
  body<T = unknown>(): Promise<T>;
}

export interface HttpResponse<TNative = unknown> {
  /** Underlying framework response object. Never `null` or `undefined`. */
  readonly native: TNative;
  /**
   * `false` before any response method is called; `true` immediately after
   * `json`, `send`, `end`, or `redirect` resolves.
   *
   * Once `true`, all response methods must be silent no-ops (must not throw).
   */
  readonly sent: boolean;
  /** Set the response status code. Chainable. */
  status(code: number): this;
  /** Set a single response header. Chainable. */
  header(name: string, value: string | string[]): this;
  /**
   * Serialize `data` as JSON, set `Content-Type: application/json`, and
   * send the response. Sets `sent = true`.
   */
  json(data: unknown): Promise<void>;
  /**
   * Send a string, Buffer, or Uint8Array body.
   * Must set a `text/*` Content-Type for string bodies.
   * Sets `sent = true`.
   */
  send(body?: string | Buffer | Uint8Array): Promise<void>;
  /** Redirect to `url` with the given status code (default `302`). Sets `sent = true`. */
  redirect(url: string, code?: number): Promise<void>;
  /** End the response with no body. Sets `sent = true`. */
  end(): Promise<void>;
}
