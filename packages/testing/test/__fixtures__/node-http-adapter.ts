/**
 * Minimal node:http adapter — TEST FIXTURE ONLY, not published.
 *
 * Implements HttpAdapter using only Node's built-in `http` module with an
 * inline colon-param router. Serves as a portability proof for the
 * conformance suite: no auto-parsing, no auto-error-rendering, no router lib.
 */
import * as http from "node:http";
import type {
  HttpAdapter,
  HttpMethod,
  HttpContext,
  HttpRequest,
  HttpResponse,
  RouteDefinition,
} from "@decorify/core";

type MatchFn = (path: string) => false | { params: Record<string, string> };

interface RouteEntry {
  method: HttpMethod;
  matcher: MatchFn;
  handler: RouteDefinition["handler"];
}

/** Compiles an Express-style colon-param path pattern into a matcher function. */
function compilePath(pattern: string): MatchFn {
  const keys: string[] = [];
  const regexStr = pattern.replace(/:([^/]+)/g, (_full, key: string) => {
    keys.push(key);
    return "([^/]+)";
  });
  const re = new RegExp(`^${regexStr}$`);
  return (path) => {
    const m = re.exec(path);
    if (!m) return false;
    const params: Record<string, string> = {};
    for (let i = 0; i < keys.length; i++) params[keys[i]!] = m[i + 1]!;
    return { params };
  };
}

export class NodeHttpAdapter implements HttpAdapter<http.Server> {
  readonly native: http.Server;
  readonly #routes: RouteEntry[] = [];

  constructor() {
    this.native = http.createServer((req, res) =>
      this.#dispatch(req, res).catch((err) => {
        if (!res.headersSent) {
          console.error("Internal Server Error", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
      }),
    );
  }

  registerRoute(route: RouteDefinition): void {
    this.#routes.push({
      method: route.method,
      matcher: compilePath(route.path),
      handler: route.handler,
    });
  }

  async listen(port: number, host = "127.0.0.1"): Promise<number> {
    return new Promise((resolve, reject) => {
      this.native.once("error", reject);
      this.native.listen(port, host, () => {
        const addr = this.native.address();
        resolve(typeof addr === "object" && addr ? addr.port : 0);
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.native.closeAllConnections();
      this.native.close((err) => (err ? reject(err) : resolve()));
    });
  }

  async #dispatch(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const rawUrl = req.url ?? "/";
    const qIdx = rawUrl.indexOf("?");
    const pathname = qIdx === -1 ? rawUrl : rawUrl.slice(0, qIdx);
    const method = req.method?.toUpperCase() as HttpMethod;

    let matchedRoute: RouteEntry | undefined;
    let params: Record<string, string> = {};

    for (const route of this.#routes) {
      if (route.method !== method) continue;
      const result = route.matcher(pathname);
      if (result === false) continue;
      matchedRoute = route;
      params = result.params;
      break;
    }

    if (!matchedRoute) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
      return;
    }

    const ctx = buildNodeContext(req, res, rawUrl, pathname, params);

    try {
      await Promise.resolve(matchedRoute.handler(ctx));
    } catch (err) {
      if (!res.headersSent) {
        console.error("Internal Server Error", err);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Server Error" }));
      }
    }
  }
}

function buildNodeContext(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  rawUrl: string,
  pathname: string,
  params: Record<string, string>,
): HttpContext<http.IncomingMessage, http.ServerResponse> {
  let bodyCache: Promise<unknown> | undefined;
  const query = parseQuery(rawUrl);
  const headers = normalizeHeaders(req.headers);

  const httpReq: HttpRequest<http.IncomingMessage> = {
    native: req,
    method: req.method?.toUpperCase() ?? "GET",
    path: pathname,
    url: rawUrl,
    headers,
    query,
    params,
    body: <T>() => (bodyCache ??= readBody(req, res)) as Promise<T>,
  };

  const httpRes: HttpResponse<http.ServerResponse> = {
    native: res,
    get sent() {
      return res.headersSent;
    },
    status(code) {
      res.statusCode = code;
      return this;
    },
    header(name, value) {
      res.setHeader(name, value);
      return this;
    },
    async json(data) {
      if (res.headersSent) return;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(data));
    },
    async send(body) {
      if (res.headersSent) return;
      if (body === undefined || body === "") {
        res.end();
        return;
      }
      if (typeof body === "string") {
        res.setHeader("Content-Type", "text/plain");
        res.end(body);
      } else {
        res.end(body);
      }
    },
    async redirect(url, code = 302) {
      if (res.headersSent) return;
      res.writeHead(code, { Location: url });
      res.end();
    },
    async end() {
      if (res.headersSent) return;
      res.end();
    },
  };

  return { req: httpReq, res: httpRes, state: {} };
}

/** Read + parse request body. Enforces a 100 kb limit. */
async function readBody(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<unknown> {
  const MAX = 100_000;
  const contentLength = parseInt(
    String(req.headers["content-length"] ?? "0"),
    10,
  );

  if (!Number.isNaN(contentLength) && contentLength > MAX) {
    res.writeHead(413, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Payload Too Large" }));
    throw new Error("Payload Too Large");
  }

  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    total += (chunk as Buffer).length;
    if (total > MAX) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Payload Too Large" }));
      throw new Error("Payload Too Large");
    }
    chunks.push(chunk as Buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  const ct = req.headers["content-type"] ?? "";

  if (ct.includes("application/json")) {
    return JSON.parse(raw);
  }
  return raw;
}

function normalizeHeaders(
  raw: http.IncomingHttpHeaders,
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k.toLowerCase()] = v;
  }
  return out;
}

function parseQuery(
  rawUrl: string,
): Record<string, string | string[] | undefined> {
  const idx = rawUrl.indexOf("?");
  if (idx === -1) return {};
  const result: Record<string, string | string[]> = {};
  for (const [k, v] of new URLSearchParams(rawUrl.slice(idx + 1))) {
    const existing = result[k];
    if (existing === undefined) result[k] = v;
    else if (Array.isArray(existing)) existing.push(v);
    else result[k] = [existing, v];
  }
  return result;
}
