import type { HttpRequest, HttpResponse } from "@decorify/core";
import type { Request, Response } from "express";
import { pipeline } from "node:stream/promises";
import type { ExpressContext } from "./type.ts";

export function buildContext(req: Request, res: Response): ExpressContext {
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
      redirect: async (url, code = 302) => {
        res.redirect(code, url);
      },
      end: async () => {
        res.end();
      },
    };
    return self;
  })();

  return { req: httpReq, res: httpRes, state: new Map(), raw: { req, res } };
}
