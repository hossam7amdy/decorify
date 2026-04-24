import express from "express";
import { pipeline } from "node:stream/promises";
import { Server, type AddressInfo } from "node:net";
import type { Express, Request, Response } from "express";
import type { HttpAdapter, RouteDefinition } from "@decorify/core";
import type { HttpContext, HttpRequest, HttpResponse } from "@decorify/core";

export type ExpressContext = HttpContext<Request, Response>;

export class ExpressAdapter implements HttpAdapter<Express> {
  readonly native: Express;
  #serverPromise?: Promise<Server>;

  constructor(opts: { jsonLimit?: string } = {}) {
    this.native = express();
    this.native.disable("x-powered-by");
    this.native.use(express.json({ limit: opts.jsonLimit ?? "1mb" }));
    this.native.use(express.urlencoded({ extended: true }));
  }

  registerRoute(route: RouteDefinition): void {
    const method = route.method.toLowerCase() as Lowercase<
      RouteDefinition["method"]
    >;

    this.native[method](route.path, async (req, res, next) => {
      const ctx = buildContext(req, res);

      try {
        await Promise.resolve(route.handler(ctx));
      } catch (err) {
        next(err);
      }
    });
  }

  async listen(port: number, host: string = "0.0.0.0"): Promise<number> {
    if (this.#serverPromise) {
      const server = await this.#serverPromise;
      return (server.address() as AddressInfo).port;
    }

    this.#serverPromise = (() =>
      new Promise<Server>((resolve, reject) => {
        const server = this.native.listen(port, host, (error) => {
          if (error) reject(error);
          else resolve(server);
        });
      }))();

    const server = await this.#serverPromise;
    return (server.address() as AddressInfo).port;
  }

  async close(): Promise<void> {
    if (!this.#serverPromise) return;
    const server = await this.#serverPromise;
    this.#serverPromise = undefined;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

function buildContext(req: Request, res: Response): ExpressContext {
  let bodyPromise: Promise<unknown> | undefined;

  const httpReq: HttpRequest = {
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    headers: req.headers,
    query: req.query as Record<string, string | string[] | undefined>,
    params: req.params as Readonly<Record<string, string>>,
    body: <T>() => (bodyPromise ??= Promise.resolve(req.body)) as Promise<T>,
  };

  const httpRes: HttpResponse = (() => {
    const self: HttpResponse = {
      get sent() {
        return res.headersSent;
      },
      status: (code) => {
        res.status(code);
        return self;
      },
      header: (n, v) => {
        res.setHeader(n, v);
        return self;
      },
      send: async (b) => {
        res.send(b);
      },
      json: async (d) => {
        res.json(d);
      },
      stream: async (s) => {
        try {
          await pipeline(s, res);
        } catch (err) {
          if (
            (err as NodeJS.ErrnoException)?.code ===
            "ERR_STREAM_PREMATURE_CLOSE"
          ) {
            return;
          }
          throw err;
        }
      },
      redirect: async (u, code = 302) => {
        res.redirect(code, u);
      },
      end: async () => {
        res.end();
      },
    };
    return self;
  })();

  return { req: httpReq, res: httpRes, state: new Map(), raw: { req, res } };
}
