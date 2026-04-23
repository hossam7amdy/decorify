import { describe, it, expect } from "vitest";
import {
  UseMiddleware,
  CONTROLLER_MIDDLEWARE,
  ROUTE_MIDDLEWARE,
} from "./middleware.ts";
import type { Middleware } from "../middleware.ts";

describe("@UseMiddleware", () => {
  const dummyMw: Middleware = async (_ctx, next) => {
    await next();
  };
  const anotherMw: Middleware = async (_ctx, next) => {
    await next();
  };

  it("on a class stores to CONTROLLER_MIDDLEWARE", () => {
    @UseMiddleware(dummyMw)
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    const mws = meta[CONTROLLER_MIDDLEWARE] as Middleware[];
    expect(mws).toHaveLength(1);
    expect(mws[0]).toBe(dummyMw);
  });

  it("on a class accumulates multiple middleware", () => {
    @UseMiddleware(dummyMw, anotherMw)
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    const mws = meta[CONTROLLER_MIDDLEWARE] as Middleware[];
    expect(mws).toHaveLength(2);
    expect(mws).toEqual([dummyMw, anotherMw]);
  });

  it("on a method stores to ROUTE_MIDDLEWARE map keyed by method name", () => {
    class TestCtrl {
      @UseMiddleware(dummyMw)
      handler() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const map = meta[ROUTE_MIDDLEWARE] as Map<string | symbol, Middleware[]>;
    expect(map).toBeInstanceOf(Map);
    const mws = map.get("handler");
    expect(mws).toHaveLength(1);
    expect(mws![0]).toBe(dummyMw);
  });

  it("on different methods stores separate entries in the map", () => {
    class TestCtrl {
      @UseMiddleware(dummyMw)
      handler1() {}

      @UseMiddleware(anotherMw)
      handler2() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const map = meta[ROUTE_MIDDLEWARE] as Map<string | symbol, Middleware[]>;
    expect(map.get("handler1")).toEqual([dummyMw]);
    expect(map.get("handler2")).toEqual([anotherMw]);
  });

  it("accumulates multiple middleware on the same method", () => {
    class TestCtrl {
      @UseMiddleware(dummyMw, anotherMw)
      handler() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const map = meta[ROUTE_MIDDLEWARE] as Map<string | symbol, Middleware[]>;
    expect(map.get("handler")).toEqual([dummyMw, anotherMw]);
  });

  it("throws on static method", () => {
    expect(() => {
      class TestCtrl {
        @UseMiddleware(dummyMw)
        static staticHandler() {}
      }
    }).toThrow("must target public instance methods");
  });
});
