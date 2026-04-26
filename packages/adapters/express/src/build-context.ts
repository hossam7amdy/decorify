import type { HttpRequest, HttpResponse } from "@decorify/core";
import type { Request, Response } from "express";
import type { ExpressContext } from "./type.ts";

export function buildContext(req: Request, res: Response): ExpressContext {
  let bodyPromise: Promise<unknown> | undefined;

  const httpReq: HttpRequest<Request> = {
    native: req,
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    headers: req.headers,
    query: req.query as Record<string, string | string[] | undefined>,
    params: req.params as Readonly<Record<string, string>>,
    body: <T>() => (bodyPromise ??= Promise.resolve(req.body)) as Promise<T>,
  };

  const httpRes: HttpResponse<Response> = {
    native: res,
    get sent() {
      return res.headersSent;
    },
    status: (code) => {
      res.status(code);
      return httpRes;
    },
    header: (n, v) => {
      res.setHeader(n, v);
      return httpRes;
    },
    send: async (b) => {
      if (res.headersSent) return;
      res.send(b);
    },
    json: async (d) => {
      if (res.headersSent) return;
      res.json(d);
    },
    redirect: async (url, code = 302) => {
      if (res.headersSent) return;
      res.redirect(code, url);
    },
    end: async () => {
      if (res.headersSent) return;
      res.end();
    },
  };

  return { req: httpReq, res: httpRes, state: {} };
}
