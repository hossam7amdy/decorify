import { describe, it, expect, vi } from "vitest";
import { DI_INJECTABLE, DI_LIFETIME, Lifetime } from "@decorify/di";
import { Controller, CONTROLLER_META } from "./controller.ts";
import { Get, Post, Put, Patch, Delete, Route, ROUTE_META } from "./route.ts";
import type { RouteMeta } from "./route.ts";
import {
  UseMiddleware,
  CONTROLLER_MIDDLEWARE,
  ROUTE_MIDDLEWARE,
} from "./middleware.ts";
import type { Middleware, Next } from "../middleware.ts";
import type { HttpContext } from "../http/context.ts";

describe("@Controller", () => {
  it("stores prefix in Symbol.metadata[CONTROLLER_META]", () => {
    @Controller("/api")
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    expect(meta[CONTROLLER_META]).toEqual({ prefix: "/api" });
  });

  it("stores undefined prefix when called without arguments", () => {
    @Controller()
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    expect(meta[CONTROLLER_META]).toEqual({ prefix: undefined });
  });

  it("sets DI_INJECTABLE metadata to true", () => {
    @Controller("/test")
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    expect(meta[DI_INJECTABLE]).toBe(true);
  });

  it("sets DI_LIFETIME metadata to SINGLETON", () => {
    @Controller("/test")
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    expect(meta[DI_LIFETIME]).toBe(Lifetime.SINGLETON);
  });
});

describe("@Get, @Post, @Put, @Patch, @Delete", () => {
  it("@Get stores route metadata with method GET", () => {
    class TestCtrl {
      @Get("/items")
      getItems() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const routes = meta[ROUTE_META] as RouteMeta[];
    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual({
      method: "GET",
      path: "/items",
      propertyKey: "getItems",
    });
  });

  it("@Post stores route metadata with method POST", () => {
    class TestCtrl {
      @Post("/items")
      createItem() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const routes = meta[ROUTE_META] as RouteMeta[];
    expect(routes).toHaveLength(1);
    expect(routes[0]).toEqual({
      method: "POST",
      path: "/items",
      propertyKey: "createItem",
    });
  });

  it("@Put stores route metadata with method PUT", () => {
    class TestCtrl {
      @Put("/items/:id")
      updateItem() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const routes = meta[ROUTE_META] as RouteMeta[];
    expect(routes[0]!.method).toBe("PUT");
  });

  it("@Patch stores route metadata with method PATCH", () => {
    class TestCtrl {
      @Patch("/items/:id")
      patchItem() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const routes = meta[ROUTE_META] as RouteMeta[];
    expect(routes[0]!.method).toBe("PATCH");
  });

  it("@Delete stores route metadata with method DELETE", () => {
    class TestCtrl {
      @Delete("/items/:id")
      deleteItem() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const routes = meta[ROUTE_META] as RouteMeta[];
    expect(routes[0]!.method).toBe("DELETE");
  });

  it("multiple routes on different methods accumulate in the array", () => {
    class TestCtrl {
      @Get("/items")
      getItems() {}

      @Post("/items")
      createItem() {}

      @Delete("/items/:id")
      removeItem() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const routes = meta[ROUTE_META] as RouteMeta[];
    expect(routes).toHaveLength(3);
    expect(routes.map((r) => r.method)).toEqual(["GET", "POST", "DELETE"]);
    expect(routes.map((r) => r.propertyKey)).toEqual([
      "getItems",
      "createItem",
      "removeItem",
    ]);
  });

  it("@Route with arbitrary method stores metadata correctly", () => {
    class TestCtrl {
      @Route("OPTIONS", "/preflight")
      preflight() {}
    }

    const meta = (TestCtrl as any)[Symbol.metadata];
    const routes = meta[ROUTE_META] as RouteMeta[];
    expect(routes[0]).toEqual({
      method: "OPTIONS",
      path: "/preflight",
      propertyKey: "preflight",
    });
  });

  it("throws on static method decorator", () => {
    expect(() => {
      class TestCtrl {
        @Get("/static-route")
        static staticMethod() {}
      }
    }).toThrow("must target a public instance method");
  });
});

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
