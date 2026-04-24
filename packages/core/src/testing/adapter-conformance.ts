import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";
import type { HttpAdapter } from "../http/adapter.ts";
import type { HttpContext } from "../http/context.ts";

export interface AdapterConformanceOptions<TAdapter> {
  name: string;
  makeAdapter: () => TAdapter;
}

export function runAdapterConformance<TAdapter extends HttpAdapter>(
  opts: AdapterConformanceOptions<TAdapter>,
) {
  describe(`Adapter Conformance: ${opts.name}`, () => {
    let adapter: TAdapter;
    let baseUrl: string;

    beforeEach(async () => {
      adapter = opts.makeAdapter();
      const port = await adapter.listen(0);
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
      await adapter.close();
    });

    describe("Route Registration", () => {
      it("registers a GET route and responds with 200", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/get",
          handler: async (ctx: HttpContext) => {
            await ctx.res.status(200).send("get-ok");
          },
        });

        const res = await fetch(`${baseUrl}/conformance/get`);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("get-ok");
      });

      it("registers a POST route and responds with 201", async () => {
        adapter.registerRoute({
          method: "POST",
          path: "/conformance/post",
          handler: async (ctx: HttpContext) => {
            await ctx.res.status(201).send("post-ok");
          },
        });

        const res = await fetch(`${baseUrl}/conformance/post`, {
          method: "POST",
        });
        expect(res.status).toBe(201);
        expect(await res.text()).toBe("post-ok");
      });

      it("handles route params (:id) correctly", async () => {
        let capturedId: string | undefined;
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/users/:id",
          handler: async (ctx: HttpContext) => {
            capturedId = ctx.req.params["id"];
            await ctx.res.status(200).send("param-ok");
          },
        });

        const res = await fetch(`${baseUrl}/conformance/users/123`);
        expect(res.status).toBe(200);
        expect(capturedId).toBe("123");
      });
    });

    describe("HTTP Methods", () => {
      const testCases = [
        { method: "POST", status: 200, body: "created" },
        { method: "PUT", status: 200, body: "put-ok" },
        { method: "PATCH", status: 200, body: "patch-ok" },
        { method: "DELETE", status: 204, body: "" },
        { method: "OPTIONS", status: 200, body: "" },
        { method: "HEAD", status: 200, body: "" },
      ] as const;

      for (const { method, status, body } of testCases) {
        it(`registers ${method} route`, async () => {
          adapter.registerRoute({
            method,
            path: `/conformance/${method.toLowerCase()}`,
            handler: async (ctx: HttpContext) => {
              await ctx.res.status(status).send(body);
            },
          });

          const res = await fetch(
            `${baseUrl}/conformance/${method.toLowerCase()}`,
            { method },
          );
          expect(res.status).toBe(status);
          expect(await res.text()).toBe(body);
        });
      }
    });

    describe("HttpRequest Contract", () => {
      it("req.method returns correct HTTP method", async () => {
        let method: string | undefined;
        adapter.registerRoute({
          method: "POST",
          path: "/conformance/req/method",
          handler: async (ctx: HttpContext) => {
            method = ctx.req.method;
            await ctx.res.status(200).end();
          },
        });

        await fetch(`${baseUrl}/conformance/req/method`, { method: "POST" });
        expect(method).toBe("POST");
      });

      it("req.path returns the path without query string", async () => {
        let path: string | undefined;
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/req/path",
          handler: async (ctx: HttpContext) => {
            path = ctx.req.path;
            await ctx.res.status(200).end();
          },
        });

        await fetch(`${baseUrl}/conformance/req/path?foo=bar`);
        expect(path).toBe("/conformance/req/path");
      });

      it("req.url returns full URL with query string", async () => {
        let url: string | undefined;
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/req/url",
          handler: async (ctx: HttpContext) => {
            url = ctx.req.url;
            await ctx.res.status(200).end();
          },
        });

        await fetch(`${baseUrl}/conformance/req/url?foo=bar`);
        expect(url).toContain("/conformance/req/url?foo=bar");
      });

      it("req.query parses query parameters correctly", async () => {
        let query: Record<string, string | string[] | undefined> = {};
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/req/query",
          handler: async (ctx: HttpContext) => {
            query = ctx.req.query;
            await ctx.res.status(200).end();
          },
        });

        await fetch(`${baseUrl}/conformance/req/query?foo=bar&baz=1`);
        expect(query["foo"]).toBe("bar");
        expect(query["baz"]).toBe("1");
      });

      it("req.headers exposes request headers (case-insensitive access)", async () => {
        let headers: Record<string, string | string[] | undefined> = {};
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/req/headers",
          handler: async (ctx: HttpContext) => {
            headers = ctx.req.headers;
            await ctx.res.status(200).end();
          },
        });

        await fetch(`${baseUrl}/conformance/req/headers`, {
          headers: { "X-Custom-Header": "hello" },
        });
        expect(headers["x-custom-header"]).toBe("hello");
      });

      it("req.body() returns parsed JSON body", async () => {
        let body: unknown;
        adapter.registerRoute({
          method: "POST",
          path: "/conformance/req/body",
          handler: async (ctx: HttpContext) => {
            body = await ctx.req.body();
            await ctx.res.status(200).end();
          },
        });

        await fetch(`${baseUrl}/conformance/req/body`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "hello" }),
        });
        expect(body).toEqual({ message: "hello" });
      });
    });

    describe("HttpResponse Contract", () => {
      it("res.json(data) sends JSON with correct content-type", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/json",
          handler: async (ctx: HttpContext) => {
            await ctx.res.json({ result: "success" });
          },
        });

        const res = await fetch(`${baseUrl}/conformance/res/json`);
        expect(res.headers.get("content-type")).toContain("application/json");
        expect(await res.json()).toEqual({ result: "success" });
      });

      it("res.send(string) sends string body", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/send",
          handler: async (ctx: HttpContext) => {
            await ctx.res.send("plain text");
          },
        });

        const res = await fetch(`${baseUrl}/conformance/res/send`);
        expect(await res.text()).toBe("plain text");
      });

      it("res.status(code) sets the status code", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/status",
          handler: async (ctx: HttpContext) => {
            await ctx.res.status(201).end();
          },
        });

        const res = await fetch(`${baseUrl}/conformance/res/status`);
        expect(res.status).toBe(201);
      });

      it("res.header(name, value) sets a response header", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/header",
          handler: async (ctx: HttpContext) => {
            await ctx.res.header("X-Response-Header", "world").end();
          },
        });

        const res = await fetch(`${baseUrl}/conformance/res/header`);
        expect(res.headers.get("x-response-header")).toBe("world");
      });

      it("res.sent is false before response, true after json()", async () => {
        let sentBefore = true;
        let sentAfter = false;

        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/sent-json",
          handler: async (ctx: HttpContext) => {
            sentBefore = ctx.res.sent;
            await ctx.res.json({ ok: true });
            sentAfter = ctx.res.sent;
          },
        });

        await fetch(`${baseUrl}/conformance/res/sent-json`);
        expect(sentBefore).toBe(false);
        expect(sentAfter).toBe(true);
      });

      it("res.sent is true after send()", async () => {
        let sentBefore = true;
        let sentAfter = false;

        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/sent-send",
          handler: async (ctx: HttpContext) => {
            sentBefore = ctx.res.sent;
            await ctx.res.send("ok");
            sentAfter = ctx.res.sent;
          },
        });

        await fetch(`${baseUrl}/conformance/res/sent-send`);
        expect(sentBefore).toBe(false);
        expect(sentAfter).toBe(true);
      });

      it("res.end() sends empty response", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/end",
          handler: async (ctx: HttpContext) => {
            await ctx.res.status(204).end();
          },
        });

        const res = await fetch(`${baseUrl}/conformance/res/end`);
        expect(res.status).toBe(204);
        expect(await res.text()).toBe("");
      });

      it("res.redirect(url, code) sends redirect", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/redirect",
          handler: async (ctx: HttpContext) => {
            await ctx.res.redirect("/target", 301);
          },
        });

        const res = await fetch(`${baseUrl}/conformance/res/redirect`, {
          redirect: "manual",
        });
        expect(res.status).toBe(301);
        expect(res.headers.get("location")).toContain("/target");
      });

      it("res.stream(stream) pipes a readable stream to the client", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/stream",
          handler: async (ctx: HttpContext) => {
            const stream = Readable.from([
              "chunk1",
              "-",
              "chunk2",
              "-",
              "chunk3",
            ]);
            await ctx.res.stream(stream);
          },
        });

        const res = await fetch(`${baseUrl}/conformance/res/stream`);
        expect(res.status).toBe(200);
        expect(await res.text()).toBe("chunk1-chunk2-chunk3");
      });

      it("res.stream(stream) handles premature client disconnects gracefully", async () => {
        const { promise: handlerDone, resolve: resolveHandlerDone } =
          Promise.withResolvers<void>();

        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/stream-abort",
          handler: async (ctx: HttpContext) => {
            let pushed = false;
            const stream = new Readable({
              read() {
                if (!pushed) {
                  pushed = true;
                  this.push("chunk1\n");
                }
                // Stall — no more data until the stream is destroyed on disconnect
              },
            });
            try {
              await ctx.res.stream(stream);
            } finally {
              resolveHandlerDone();
            }
          },
        });

        // Health route — proves the server is still alive after the abort
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/res/stream-abort-health",
          handler: async (ctx: HttpContext) => {
            await ctx.res.status(200).send("alive");
          },
        });

        const controller = new AbortController();
        const res = await fetch(`${baseUrl}/conformance/res/stream-abort`, {
          signal: controller.signal,
        });
        expect(res.status).toBe(200);
        const reader = res.body!.getReader();
        const { done } = await reader.read();
        expect(done).toBe(false);
        controller.abort();

        // resolves only when handler's finally block runs
        await handlerDone;

        const health = await fetch(
          `${baseUrl}/conformance/res/stream-abort-health`,
        );
        expect(health.status).toBe(200);
        expect(await health.text()).toBe("alive");
      });
    });

    describe("Error Propagation", () => {
      it("synchronous handler throw results in 500", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/error/sync",
          handler: () => {
            throw new Error("sync error");
          },
        });

        const res = await fetch(`${baseUrl}/conformance/error/sync`);
        expect(res.status).toBe(500);
      });

      it("async handler rejection results in 500", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/error/async",
          handler: async () => {
            return Promise.reject(new Error("async error"));
          },
        });

        const res = await fetch(`${baseUrl}/conformance/error/async`);
        expect(res.status).toBe(500);
      });
    });

    describe("HttpContext Contract", () => {
      it("ctx.state is a per-request Map", async () => {
        let isMap = false;
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/ctx/state",
          handler: async (ctx: HttpContext) => {
            isMap = ctx.state instanceof Map;
            ctx.state.set("user", "test");
            await ctx.res.status(200).send(ctx.state.get("user") as string);
          },
        });

        const res = await fetch(`${baseUrl}/conformance/ctx/state`);
        expect(isMap).toBe(true);
        expect(await res.text()).toBe("test");
      });

      it("ctx.raw provides access to native request/response", async () => {
        adapter.registerRoute({
          method: "GET",
          path: "/conformance/ctx/raw",
          handler: async (ctx: HttpContext) => {
            const valid =
              ctx.raw != null &&
              typeof ctx.raw.req === "object" &&
              ctx.raw.req !== null &&
              typeof ctx.raw.res === "object" &&
              ctx.raw.res !== null;
            await ctx.res.status(valid ? 200 : 500).end();
          },
        });

        const res = await fetch(`${baseUrl}/conformance/ctx/raw`);
        expect(res.status).toBe(200);
      });
    });
  });
}
