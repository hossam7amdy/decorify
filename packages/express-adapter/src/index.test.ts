import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExpressAdapter } from "./index.js";
import express from "express";

describe("ExpressAdapter", () => {
  describe("constructor and getInstance", () => {
    it("should initialize with a default express app", () => {
      const adapter = new ExpressAdapter();
      const app = adapter.getInstance();
      expect(app).toBeDefined();
      expect(typeof app.use).toBe("function");
      expect(typeof app.listen).toBe("function");
    });

    it("should use the provided express app instance", () => {
      const mockApp = express();
      const adapter = new ExpressAdapter(mockApp);
      expect(adapter.getInstance()).toBe(mockApp);
    });
  });

  describe("listen and close", () => {
    let adapter: ExpressAdapter;

    beforeEach(() => {
      adapter = new ExpressAdapter();
    });

    afterEach(async () => {
      await adapter.close();
    });

    it("should resolve after listen and expose a server address", async () => {
      const cbSpy = { called: false };
      await adapter.listen(0, () => {
        cbSpy.called = true;
      });
      expect(cbSpy.called).toBe(true);
      const address = (adapter as any).server?.address();
      expect(address).toBeDefined();
      expect(typeof (address as any).port).toBe("number");
    });

    it("should resolve when closing unstarted server (no-op)", async () => {
      const freshAdapter = new ExpressAdapter();
      await expect(freshAdapter.close()).resolves.toBeUndefined();
    });

    it("should null out the server address after close", async () => {
      await adapter.listen(0);
      await adapter.close();
      expect((adapter as any).server).toBeNull();
    });
  });

  describe("registerRoute and createContext", () => {
    let adapter: ExpressAdapter;
    let port: number;

    const startServer = async () => {
      await adapter.listen(0);
      const address = (adapter as any).server?.address();
      port = typeof address === "object" && address ? address.port : 0;
    };

    beforeEach(() => {
      adapter = new ExpressAdapter();
    });

    afterEach(async () => {
      await adapter.close();
    });

    it("should map method, path, req, and res onto the HttpContext", async () => {
      let capturedMethod: string | undefined;
      let capturedPath: string | undefined;
      let hasReq = false;
      let hasRes = false;

      adapter.registerRoute("post", "/full", (ctx) => {
        capturedMethod = ctx.method;
        capturedPath = ctx.path;
        hasReq = ctx.req != null;
        hasRes = ctx.res != null;
        ctx.status(202).send("ok");
      });
      await startServer();

      const response = await fetch(`http://localhost:${port}/full`, {
        method: "POST",
      });
      expect(response.status).toBe(202);
      expect(await response.text()).toBe("ok");
      expect(capturedMethod).toBe("post");
      expect(capturedPath).toBe("/full");
      expect(hasReq).toBe(true);
      expect(hasRes).toBe(true);
    });

    it("should populate ctx.params and ctx.query from the request", async () => {
      adapter.registerRoute("get", "/items/:id", (ctx) => {
        ctx.json({ id: ctx.params.id, q: ctx.query.q });
      });
      await startServer();

      const response = await fetch(`http://localhost:${port}/items/42?q=hello`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: "42", q: "hello" });
    });

    it("should parse JSON body from POST requests", async () => {
      adapter.registerRoute("post", "/body", (ctx) => {
        ctx.json({ echo: ctx.body });
      });
      await startServer();

      const response = await fetch(`http://localhost:${port}/body`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hello: "world" }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ echo: { hello: "world" } });
    });

    it("should expose incoming headers and allow setting response headers", async () => {
      adapter.registerRoute("get", "/headers", (ctx) => {
        expect(ctx.headers["x-req-header"]).toBe("req-val");
        ctx.setHeader("x-res-header", "res-val").send("ok");
      });
      await startServer();

      const response = await fetch(`http://localhost:${port}/headers`, {
        headers: { "x-req-header": "req-val" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-res-header")).toBe("res-val");
    });

    it("should redirect with the provided status code", async () => {
      adapter.registerRoute("get", "/redir", (ctx) => {
        ctx.redirect("/target", 301);
      });
      await startServer();

      const response = await fetch(`http://localhost:${port}/redir`, {
        redirect: "manual",
      });
      expect(response.status).toBe(301);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("should default redirect status to 302", async () => {
      adapter.registerRoute("get", "/redir-default", (ctx) => {
        ctx.redirect("/target");
      });
      await startServer();

      const response = await fetch(`http://localhost:${port}/redir-default`, {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/target");
    });

    it("should forward thrown errors to the next() error handler", async () => {
      adapter.registerRoute("get", "/error", () => {
        throw new Error("kaboom");
      });
      await startServer();

      const response = await fetch(`http://localhost:${port}/error`);
      expect(response.status).toBe(500);
    });

    describe("responseSent — double-response prevention", () => {
      it("should be false initially and true after ctx.send()", async () => {
        let sentBefore = true;
        let sentAfter = false;

        adapter.registerRoute("get", "/double-send", (ctx) => {
          sentBefore = ctx.responseSent;
          ctx.status(200).send("first");
          sentAfter = ctx.responseSent;
          // this second call must be silently ignored
          ctx.status(201).send("second");
        });
        await startServer();

        const response = await fetch(`http://localhost:${port}/double-send`);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("first");
        expect(sentBefore).toBe(false);
        expect(sentAfter).toBe(true);
      });

      it("should ignore second ctx.json() call after first succeeds", async () => {
        adapter.registerRoute("get", "/double-json", (ctx) => {
          ctx.status(200).json({ step: 1 });
          ctx.status(201).json({ step: 2 }); // ignored
        });
        await startServer();

        const response = await fetch(`http://localhost:${port}/double-json`);
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ step: 1 });
      });

      it("should ignore second ctx.redirect() call after first succeeds", async () => {
        adapter.registerRoute("get", "/double-redir", (ctx) => {
          ctx.redirect("/target1", 301);
          ctx.redirect("/target2", 302); // ignored
        });
        await startServer();

        const response = await fetch(`http://localhost:${port}/double-redir`, {
          redirect: "manual",
        });
        expect(response.status).toBe(301);
        expect(response.headers.get("location")).toBe("/target1");
      });

      it("should detect res.headersSent from underlying Express response", async () => {
        let responseSentAfterRawWrite = false;

        adapter.registerRoute("get", "/raw-write", (ctx) => {
          // Write the response directly via the underlying res object
          ctx.res.writeHead(200, { "Content-Type": "text/plain" });
          ctx.res.end("direct");
          responseSentAfterRawWrite = ctx.responseSent;
          // This must be silently ignored
          ctx.send("should-be-ignored");
        });
        await startServer();

        const response = await fetch(`http://localhost:${port}/raw-write`);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("direct");
        expect(responseSentAfterRawWrite).toBe(true);
      });
    });
  });
});
