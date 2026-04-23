import { describe, it, expect } from "vitest";
import { Get, Post, Put, Patch, Delete, Route, ROUTE_META } from "./route.ts";
import type { RouteMeta } from "./route.ts";

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
