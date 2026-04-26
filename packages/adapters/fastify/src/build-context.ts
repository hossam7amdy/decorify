import type { HttpRequest, HttpResponse } from "@decorify/core";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { FastifyContext } from "./type.ts";

export function buildContext(
  req: FastifyRequest,
  reply: FastifyReply,
): FastifyContext {
  let bodyPromise: Promise<unknown> | undefined;

  const httpReq: HttpRequest<FastifyRequest> = {
    native: req,
    method: req.method,
    path: req.url.split("?")[0] || "/", // Fastify's req.url includes query string. req.routerPath is the pattern, not actual path
    url: req.url,
    headers: req.headers,
    query: (req.query as Record<string, string | string[] | undefined>) || {},
    params: (req.params as Readonly<Record<string, string>>) || {},
    body: <T>() => (bodyPromise ??= Promise.resolve(req.body)) as Promise<T>,
  };

  const httpRes: HttpResponse<FastifyReply> = {
    native: reply,
    get sent() {
      return reply.sent;
    },
    status: (code) => {
      reply.code(code);
      return httpRes;
    },
    header: (n, v) => {
      reply.header(n, v);
      return httpRes;
    },
    send: async (b) => {
      if (reply.sent) return;
      if (typeof b === "string") {
        reply.type("text/plain");
      }
      await reply.send(b);
    },
    json: async (d) => {
      if (reply.sent) return;
      await reply.type("application/json").send(d);
    },
    redirect: async (url, code = 302) => {
      if (reply.sent) return;
      await reply.redirect(url, code);
    },
    end: async () => {
      if (reply.sent) return;
      await reply.send();
    },
  };

  return { req: httpReq, res: httpRes, state: {} };
}
