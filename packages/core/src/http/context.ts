export interface HttpContext<TReq = unknown, TRes = unknown> {
  readonly req: HttpRequest;
  readonly res: HttpResponse;
  readonly state: Map<string | symbol, unknown>; // per-request
  readonly raw: { req: TReq; res: TRes }; // escape hatch
}

export interface HttpRequest {
  readonly method: string;
  readonly path: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly query: Readonly<Record<string, string | string[] | undefined>>;
  readonly params: Readonly<Record<string, string>>;
  body<T = unknown>(): Promise<T>;
}

export interface HttpResponse {
  readonly sent: boolean;
  status(code: number): this;
  header(name: string, value: string): this;
  send(body?: string | Buffer | Uint8Array): Promise<void>;
  json(data: unknown): Promise<void>;
  stream(body: NodeJS.ReadableStream): Promise<void>;
  redirect(url: string, code?: number): Promise<void>;
  end(): Promise<void>;
}
