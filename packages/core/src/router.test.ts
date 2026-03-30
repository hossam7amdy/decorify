import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerControllers } from "./router.js";
import { Controller, Get } from "./http/decorators.js";
import { Injectable } from "@decorify/di";
import { container } from "@decorify/di";
import { LifecycleManager } from "./lifecycle/manager.js";
import type { HttpAdapter } from "./adapters/http-adapter.js";
import type { HttpContext } from "./context.js";
import { UseGuard, UseMiddleware } from "./http/middleware-decorator.js";

describe("Router", () => {
  let mockAdapter: any;
  let mockLifecycle: any;

  beforeEach(() => {
    container.clear();
    mockAdapter = {
      registerRoute: vi.fn(),
      listen: vi.fn(),
      close: vi.fn(),
      useMiddleware: vi.fn(),
      useErrorHandler: vi.fn(),
      getInstance: vi.fn(),
    };
    mockLifecycle = new LifecycleManager();
  });

  it("should register routes from decorated controllers", () => {
    @Injectable()
    @Controller("/api")
    class MyController {
      @Get("/users")
      getUsers() {
        return [{ id: 1, name: "John" }];
      }
    }

    registerControllers(
      mockAdapter as HttpAdapter,
      [MyController],
      mockLifecycle,
      {
        globalMiddleware: [],
        globalGuards: [],
        globalFilters: [],
      },
    );

    expect(mockAdapter.registerRoute).toHaveBeenCalledWith(
      "get",
      "/api/users",
      expect.any(Function),
    );
  });

  it("should sort routes (static before parameterized)", () => {
    @Injectable()
    @Controller("/api")
    class MyController {
      @Get("/:id")
      getById() {}

      @Get("/profile")
      getProfile() {}
    }

    registerControllers(
      mockAdapter as HttpAdapter,
      [MyController],
      mockLifecycle,
      {
        globalMiddleware: [],
        globalGuards: [],
        globalFilters: [],
      },
    );

    const calls = mockAdapter.registerRoute.mock.calls;
    expect(calls[0][1]).toBe("/api/profile");
    expect(calls[1][1]).toBe("/api/:id");
  });

  it("should build a pipeline that executes guards", async () => {
    const mockGuard = {
      canActivate: vi.fn().mockResolvedValue(true),
    };

    @Injectable()
    @Controller()
    @UseGuard(mockGuard)
    class MyController {
      @Get("/")
      index() {
        return "ok";
      }
    }

    registerControllers(
      mockAdapter as HttpAdapter,
      [MyController],
      mockLifecycle,
      {
        globalMiddleware: [],
        globalGuards: [],
        globalFilters: [],
      },
    );

    const handler = mockAdapter.registerRoute.mock.calls[0][2];
    const mockCtx = {
      json: vi.fn(),
    } as unknown as HttpContext;

    await handler(mockCtx);

    expect(mockGuard.canActivate).toHaveBeenCalledWith(mockCtx);
    expect(mockCtx.json).toHaveBeenCalledWith("ok");
  });

  it("should stop execution if guard returns false", async () => {
    const mockGuard = {
      canActivate: vi.fn().mockResolvedValue(false),
    };

    @Injectable()
    @Controller()
    @UseGuard(mockGuard)
    class MyController {
      @Get("/")
      index() {
        return "ok";
      }
    }

    registerControllers(
      mockAdapter as HttpAdapter,
      [MyController],
      mockLifecycle,
      {
        globalMiddleware: [],
        globalGuards: [],
        globalFilters: [],
      },
    );

    const handler = mockAdapter.registerRoute.mock.calls[0][2];
    const mockCtx = {
      json: vi.fn(),
    } as unknown as HttpContext;

    await handler(mockCtx);

    // ctx.json should NOT be called because guard failed
    expect(mockCtx.json).not.toHaveBeenCalled();
  });

  it("should execute middleware in Koa-style onion", async () => {
    const sequence: string[] = [];
    const mw1 = async (_ctx: any, next: any) => {
      sequence.push("mw1 start");
      await next();
      sequence.push("mw1 end");
    };
    const mw2 = async (_ctx: any, next: any) => {
      sequence.push("mw2 start");
      await next();
      sequence.push("mw2 end");
    };

    @Injectable()
    @Controller()
    @UseMiddleware(mw1, mw2)
    class MyController {
      @Get("/")
      index() {
        sequence.push("handler");
        return "ok";
      }
    }

    registerControllers(
      mockAdapter as HttpAdapter,
      [MyController],
      mockLifecycle,
      {
        globalMiddleware: [],
        globalGuards: [],
        globalFilters: [],
      },
    );

    const handler = mockAdapter.registerRoute.mock.calls[0][2];
    const mockCtx = {
      json: vi.fn(),
    } as unknown as HttpContext;

    await handler(mockCtx);

    expect(sequence).toEqual([
      "mw1 start",
      "mw2 start",
      "handler",
      "mw2 end",
      "mw1 end",
    ]);
  });
});
