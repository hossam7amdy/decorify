import { describe, it, expect, vi } from "vitest";
import { compose, type Middleware, type Next } from "./middleware.ts";
import type { HttpContext } from "./http/context.ts";

function mockCtx(): HttpContext {
  return {
    req: {
      method: "GET",
      path: "/test",
      url: "/test",
      headers: {},
      query: {},
      params: {},
      body: () => Promise.resolve({}),
    },
    res: {
      sent: false,
      status: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis(),
      send: vi.fn().mockResolvedValue(undefined),
      json: vi.fn().mockResolvedValue(undefined),
      stream: vi.fn().mockResolvedValue(undefined),
      redirect: vi.fn().mockResolvedValue(undefined),
      end: vi.fn().mockResolvedValue(undefined),
    },
    state: new Map(),
    raw: { req: {}, res: {} },
  } as unknown as HttpContext;
}

describe("compose()", () => {
  it("calls the handler when no middleware is provided", async () => {
    const handler = vi.fn().mockResolvedValue("done");
    const ctx = mockCtx();
    const run = compose([]);
    const result = await run(ctx, handler);
    expect(handler).toHaveBeenCalledWith(ctx);
    expect(result).toBe("done");
  });

  it("composes middleware in onion order (first wraps second)", async () => {
    const order: string[] = [];

    const mw1: Middleware = async (_ctx, next) => {
      order.push("mw1-before");
      await next();
      order.push("mw1-after");
    };

    const mw2: Middleware = async (_ctx, next) => {
      order.push("mw2-before");
      await next();
      order.push("mw2-after");
    };

    const handler = vi.fn().mockImplementation(() => {
      order.push("handler");
    });

    const ctx = mockCtx();
    await compose([mw1, mw2])(ctx, handler);

    expect(order).toEqual([
      "mw1-before",
      "mw2-before",
      "handler",
      "mw2-after",
      "mw1-after",
    ]);
  });

  it("passes context through to all middleware and handler", async () => {
    const ctx = mockCtx();
    const seenContexts: HttpContext[] = [];

    const mw: Middleware = async (c, next) => {
      seenContexts.push(c);
      await next();
    };

    const handler = vi.fn().mockImplementation((c: HttpContext) => {
      seenContexts.push(c);
    });

    await compose([mw])(ctx, handler);

    expect(seenContexts).toEqual([ctx, ctx]);
  });

  it("middleware can modify context state before next()", async () => {
    const mw: Middleware = async (ctx, next) => {
      ctx.state.set("key", "value");
      await next();
    };

    const handler = vi.fn();
    const ctx = mockCtx();
    await compose([mw])(ctx, handler);

    expect(ctx.state.get("key")).toBe("value");
  });

  it("middleware can modify/observe after next() returns", async () => {
    let terminalRan = false;
    const mw: Middleware = async (_ctx, next) => {
      await next();
      expect(terminalRan).toBe(true);
    };

    const handler = vi.fn().mockImplementation(() => {
      terminalRan = true;
    });

    await compose([mw])(mockCtx(), handler);
  });

  it("propagates errors thrown in middleware", async () => {
    const mw: Middleware = async () => {
      throw new Error("middleware error");
    };

    const handler = vi.fn();
    await expect(compose([mw])(mockCtx(), handler)).rejects.toThrow(
      "middleware error",
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("propagates errors thrown in handler", async () => {
    const handler = vi.fn().mockImplementation(() => {
      throw new Error("handler error");
    });

    await expect(compose([])(mockCtx(), handler)).rejects.toThrow(
      "handler error",
    );
  });

  it("propagates sync throws in middleware", async () => {
    const mw: Middleware = () => {
      throw new Error("sync throw");
    };

    const handler = vi.fn();
    await expect(compose([mw])(mockCtx(), handler)).rejects.toThrow(
      "sync throw",
    );
  });

  it("throws when next() is called multiple times", async () => {
    const mw: Middleware = async (_ctx, next) => {
      await next();
      await next();
    };

    const handler = vi.fn();
    await expect(compose([mw])(mockCtx(), handler)).rejects.toThrow(
      "next() called multiple times",
    );
  });

  it("middleware can short-circuit by not calling next()", async () => {
    const mw: Middleware = async () => {
      return "short-circuited";
    };

    const handler = vi.fn();
    const result = await compose([mw])(mockCtx(), handler);

    expect(result).toBe("short-circuited");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns the value from the first middleware", async () => {
    const mw: Middleware = async (_ctx, next) => {
      await next();
      return "from-mw";
    };

    const handler = vi.fn().mockReturnValue("from-handler");
    const result = await compose([mw])(mockCtx(), handler);
    expect(result).toBe("from-mw");
  });

  it("handles a single middleware correctly", async () => {
    const order: string[] = [];
    const mw: Middleware = async (_ctx, next) => {
      order.push("mw-before");
      await next();
      order.push("mw-after");
    };

    const handler = vi.fn().mockImplementation(() => {
      order.push("handler");
    });

    await compose([mw])(mockCtx(), handler);
    expect(order).toEqual(["mw-before", "handler", "mw-after"]);
  });
});
