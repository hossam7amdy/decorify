import express from "express";
import { pipeline } from "node:stream/promises";
import { Server } from "node:net";
import type { Application, Request, Response } from "express";
import type { HttpAdapter, RouteDefinition } from "@decorify/core";
import type { HttpContext, HttpRequest, HttpResponse } from "@decorify/core";

export type ExpressContext = HttpContext<Request, Response>;

export interface ExpressAdapterOptions {
  application?: Application;
  /** Defaults to '100kb' */
  jsonLimit?: string;
}

export class ExpressAdapter implements HttpAdapter<Application> {
  #server?: Server;
  readonly native: Application;

  constructor(opts: ExpressAdapterOptions = {}) {
    const { application, jsonLimit } = opts;
    this.native = application ?? express();
    this.native.disable("x-powered-by");
    this.native.use(express.json({ limit: jsonLimit ?? "100kb" }));
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
    if (this.#server) {
      throw new Error(
        `Server is already listening on ${getServerAddress(this.#server)}`,
      );
    }

    const server = (this.#server = this.native.listen(port, host));

    return new Promise((resolve, reject) => {
      server.once("listening", () => {
        resolve(getServerAddress(server));
      });
      server.once("error", (error) => {
        this.#server = undefined;
        reject(error);
      });
    });
  }

  async close(): Promise<void> {
    if (!this.#server) {
      throw new Error("Server is not running");
    }
    const server = this.#server;
    this.#server = undefined;
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
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

function getServerAddress(server: Server): number {
  const address = server.address();
  if (address && typeof address !== "string") {
    return address.port;
  }
  return 0;
}
