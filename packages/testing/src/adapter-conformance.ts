import type { HttpContext, HttpAdapter, RouteDefinition } from "@decorify/core";
import type { AdapterConformanceOptions } from "./types.ts";

export function runAdapterConformance<TAdapter extends HttpAdapter>(
  opts: AdapterConformanceOptions<TAdapter>,
) {
  const host = opts.host ?? "127.0.0.1";
  const bodyLimit = opts.bodyLimit ?? 100_000;
  const { describe, it, expect } = opts.runner;

  /**
   * Registers routes on a fresh adapter, listens on an ephemeral port,
   * runs `fn`, then closes — regardless of whether `fn` throws.
   *
   * Routes are registered BEFORE `listen()` to satisfy frameworks (e.g.
   * Fastify) that lock their routing table once the server is started.
   */
  async function withAdapter(
    routes: RouteDefinition[],
    fn: (baseUrl: string, adapter: TAdapter) => Promise<void>,
  ): Promise<void> {
    const adapter = await Promise.resolve(opts.makeAdapter());
    for (const route of routes) {
      adapter.registerRoute(route);
    }
    const port = await adapter.listen(0, host);
    try {
      await fn(`http://${host}:${port}`, adapter);
    } finally {
      await adapter.close();
    }
  }

  describe(`Adapter Conformance: ${opts.name}`, () => {
    describe("Route Registration", () => {
      it("registers a GET route and responds with 200", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/get",
              handler: async (ctx: HttpContext) => {
                await ctx.res.status(200).send("get-ok");
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/get`);
            expect(res.status).toBe(200);
            expect(await res.text()).toBe("get-ok");
          },
        );
      });

      it("registers a POST route and responds with 201", async () => {
        await withAdapter(
          [
            {
              method: "POST",
              path: "/conformance/post",
              handler: async (ctx: HttpContext) => {
                await ctx.res.status(201).send("post-ok");
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/post`, {
              method: "POST",
            });
            expect(res.status).toBe(201);
            expect(await res.text()).toBe("post-ok");
          },
        );
      });

      it("handles route params (:id) correctly", async () => {
        let capturedId: string | undefined;

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/users/:id",
              handler: async (ctx: HttpContext) => {
                capturedId = ctx.req.params["id"];
                await ctx.res.status(200).send("param-ok");
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/users/123`);
            expect(res.status).toBe(200);
            expect(capturedId).toBe("123");
          },
        );
      });

      it("req.params is {} for routes with no path parameters", async () => {
        let capturedParams: Record<string, string> | undefined;

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/no-params",
              handler: async (ctx: HttpContext) => {
                capturedParams = ctx.req.params;
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/no-params`);
            expect(capturedParams).toBeDefined();
            expect(capturedParams).toEqual({});
          },
        );
      });

      it("returns 404 for unregistered route", async () => {
        await withAdapter([], async (baseUrl) => {
          const res = await fetch(`${baseUrl}/conformance/does-not-exist`);
          expect(res.status).toBe(404);
        });
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
          await withAdapter(
            [
              {
                method,
                path: `/conformance/${method.toLowerCase()}`,
                handler: async (ctx: HttpContext) => {
                  if (body === "") {
                    await ctx.res.status(status).end();
                  } else {
                    await ctx.res.status(status).send(body);
                  }
                },
              },
            ],
            async (baseUrl) => {
              const res = await fetch(
                `${baseUrl}/conformance/${method.toLowerCase()}`,
                { method },
              );
              expect(res.status).toBe(status);
              expect(await res.text()).toBe(body);
            },
          );
        });
      }
    });

    describe("HttpRequest Contract", () => {
      it("req.method returns correct HTTP method", async () => {
        let method: string | undefined;

        await withAdapter(
          [
            {
              method: "POST",
              path: "/conformance/req/method",
              handler: async (ctx: HttpContext) => {
                method = ctx.req.method;
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/req/method`, {
              method: "POST",
            });
            expect(method).toBe("POST");
          },
        );
      });

      it("req.path returns the path without query string", async () => {
        let path: string | undefined;

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/req/path",
              handler: async (ctx: HttpContext) => {
                path = ctx.req.path;
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/req/path?foo=bar`);
            expect(path).toBe("/conformance/req/path");
          },
        );
      });

      it("req.url returns full URL with query string", async () => {
        let url: string | undefined;

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/req/url",
              handler: async (ctx: HttpContext) => {
                url = ctx.req.url;
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/req/url?foo=bar`);
            expect(url).toContain("/conformance/req/url?foo=bar");
          },
        );
      });

      it("req.query parses query parameters correctly", async () => {
        let query: Record<string, string | string[] | undefined> = {};

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/req/query",
              handler: async (ctx: HttpContext) => {
                query = ctx.req.query;
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/req/query?foo=bar&baz=1`);
            expect(query["foo"]).toBe("bar");
            expect(query["baz"]).toBe("1");
          },
        );
      });

      it("req.query parses repeated params as an array", async () => {
        let query: Record<string, string | string[] | undefined> = {};

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/req/query-array",
              handler: async (ctx: HttpContext) => {
                query = ctx.req.query;
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/req/query-array?a=1&a=2`);
            expect(query["a"]).toEqual(["1", "2"]);
          },
        );
      });

      it("req.headers exposes request headers (case-insensitive access)", async () => {
        let headers: Record<string, string | string[] | undefined> = {};

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/req/headers",
              handler: async (ctx: HttpContext) => {
                headers = ctx.req.headers;
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/req/headers`, {
              headers: { "X-Custom-Header": "hello" },
            });
            expect(headers["x-custom-header"]).toBe("hello");
          },
        );
      });

      it("req.body() returns parsed JSON body", async () => {
        let body: unknown;

        await withAdapter(
          [
            {
              method: "POST",
              path: "/conformance/req/body",
              handler: async (ctx: HttpContext) => {
                body = await ctx.req.body();
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/req/body`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: "hello" }),
            });
            expect(body).toEqual({ message: "hello" });
          },
        );
      });

      it("req.body() returns the same object reference on repeated calls", async () => {
        let first: unknown;
        let second: unknown;

        await withAdapter(
          [
            {
              method: "POST",
              path: "/conformance/req/body-twice",
              handler: async (ctx: HttpContext) => {
                first = await ctx.req.body();
                second = await ctx.req.body();
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/req/body-twice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: "hello" }),
            });
            expect(first).toEqual({ message: "hello" });
            expect(second).toBe(first);
          },
        );
      });

      it("oversized JSON body surfaces as 4xx not 5xx", async () => {
        await withAdapter(
          [
            {
              method: "POST",
              path: "/conformance/req/body-large",
              handler: async (ctx: HttpContext) => {
                await ctx.req.body();
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            const largeBody = JSON.stringify({
              data: "x".repeat(2 * bodyLimit),
            });
            const res = await fetch(`${baseUrl}/conformance/req/body-large`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: largeBody,
            });
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.status).toBeLessThan(500);
          },
        );
      });
    });

    describe("HttpResponse Contract", () => {
      it("res.json(data) sends JSON with correct content-type", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/json",
              handler: async (ctx: HttpContext) => {
                await ctx.res.json({ result: "success" });
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/res/json`);
            expect(res.headers.get("content-type")).toContain(
              "application/json",
            );
            expect(await res.json()).toEqual({ result: "success" });
          },
        );
      });

      it("res.status(code).json(data) sets both status and JSON body", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/status-json",
              handler: async (ctx: HttpContext) => {
                await ctx.res.status(201).json({ created: true });
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/res/status-json`);
            expect(res.status).toBe(201);
            expect(res.headers.get("content-type")).toContain(
              "application/json",
            );
            expect(await res.json()).toEqual({ created: true });
          },
        );
      });

      it("res.send(string) sends string body with text content-type", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/send",
              handler: async (ctx: HttpContext) => {
                await ctx.res.send("plain text");
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/res/send`);
            expect(await res.text()).toBe("plain text");
            expect(res.headers.get("content-type")?.toLowerCase()).toMatch(
              /^text\//,
            );
          },
        );
      });

      it("res.status(code) sets the status code", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/status",
              handler: async (ctx: HttpContext) => {
                await ctx.res.status(201).end();
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/res/status`);
            expect(res.status).toBe(201);
          },
        );
      });

      it("res.header(name, value) sets a response header", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/header",
              handler: async (ctx: HttpContext) => {
                await ctx.res.header("X-Response-Header", "world").end();
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/res/header`);
            expect(res.headers.get("x-response-header")).toBe("world");
          },
        );
      });

      it("res.sent is false before response, true after json()", async () => {
        let sentBefore = true;
        let sentAfter = false;

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/sent-json",
              handler: async (ctx: HttpContext) => {
                sentBefore = ctx.res.sent;
                await ctx.res.json({ ok: true });
                sentAfter = ctx.res.sent;
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/res/sent-json`);
            expect(sentBefore).toBe(false);
            expect(sentAfter).toBe(true);
          },
        );
      });

      it("res.sent is true after send()", async () => {
        let sentBefore = true;
        let sentAfter = false;

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/sent-send",
              handler: async (ctx: HttpContext) => {
                sentBefore = ctx.res.sent;
                await ctx.res.send("ok");
                sentAfter = ctx.res.sent;
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/res/sent-send`);
            expect(sentBefore).toBe(false);
            expect(sentAfter).toBe(true);
          },
        );
      });

      it("res.end() sends empty response", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/end",
              handler: async (ctx: HttpContext) => {
                await ctx.res.status(204).end();
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/res/end`);
            expect(res.status).toBe(204);
            expect(await res.text()).toBe("");
          },
        );
      });

      it("res.redirect(url, code) sends redirect", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/redirect",
              handler: async (ctx: HttpContext) => {
                await ctx.res.redirect("/target", 301);
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/res/redirect`, {
              redirect: "manual",
            });
            expect(res.status).toBe(301);
            expect(res.headers.get("location")).toContain("/target");
          },
        );
      });

      it("calling res.json() when sent === true does not throw", async () => {
        let caughtError: unknown = undefined;

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/res/double-send",
              handler: async (ctx: HttpContext) => {
                await ctx.res.json({ first: true });
                try {
                  await ctx.res.json({ second: true });
                } catch (err) {
                  caughtError = err;
                }
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/res/double-send`);
            expect(res.status).toBe(200);
            expect(caughtError).toBeUndefined();
          },
        );
      });
    });

    describe("Error Propagation", () => {
      it("synchronous handler throw results in 500", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/error/sync",
              handler: () => {
                throw new Error("sync error");
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/error/sync`);
            expect(res.status).toBe(500);
          },
        );
      });

      it("async handler rejection results in 500", async () => {
        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/error/async",
              handler: async () => {
                return Promise.reject(new Error("async error"));
              },
            },
          ],
          async (baseUrl) => {
            const res = await fetch(`${baseUrl}/conformance/error/async`);
            expect(res.status).toBe(500);
          },
        );
      });
    });

    describe("HttpContext Contract", () => {
      it("ctx.state is isolated per request", async () => {
        const { promise: barrier1, resolve: req1Ready } =
          Promise.withResolvers<void>();
        const { promise: barrier2, resolve: req2Ready } =
          Promise.withResolvers<void>();

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/ctx/state",
              handler: async (ctx: HttpContext) => {
                const id = ctx.req.query["id"] as string;
                ctx.state.id = id;
                if (id === "req1") {
                  req1Ready();
                  await barrier2;
                } else {
                  req2Ready();
                  await barrier1;
                }
                await ctx.res.status(200).send(ctx.state.id as string);
              },
            },
          ],
          async (baseUrl) => {
            const [res1, res2] = await Promise.all([
              fetch(`${baseUrl}/conformance/ctx/state?id=req1`),
              fetch(`${baseUrl}/conformance/ctx/state?id=req2`),
            ]);
            expect(await res1.text()).toBe("req1");
            expect(await res2.text()).toBe("req2");
          },
        );
      });

      it("ctx.req.native and ctx.res.native are non-null objects", async () => {
        let reqNative: unknown = null;
        let resNative: unknown = null;

        await withAdapter(
          [
            {
              method: "GET",
              path: "/conformance/ctx/native",
              handler: async (ctx: HttpContext) => {
                reqNative = ctx.req.native;
                resNative = ctx.res.native;
                await ctx.res.status(200).end();
              },
            },
          ],
          async (baseUrl) => {
            await fetch(`${baseUrl}/conformance/ctx/native`);
            expect(reqNative).not.toBeNull();
            expect(typeof reqNative).toBe("object");
            expect(resNative).not.toBeNull();
            expect(typeof resNative).toBe("object");
          },
        );
      });
    });

    describe("Server Lifecycle", () => {
      it("close() stops accepting new connections", async () => {
        const adapter = await Promise.resolve(opts.makeAdapter());
        adapter.registerRoute({
          method: "GET",
          path: "/lifecycle/alive",
          handler: async (ctx: HttpContext) => {
            await ctx.res.status(200).send("alive");
          },
        });

        const port = await adapter.listen(0, host);
        const tempUrl = `http://${host}:${port}`;

        const before = await fetch(`${tempUrl}/lifecycle/alive`);
        expect(before.status).toBe(200);

        await adapter.close();

        await expect(fetch(`${tempUrl}/lifecycle/alive`)).rejects.toThrow();
      });
    });
  });
}
