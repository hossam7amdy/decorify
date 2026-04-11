import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerControllers } from "./router.js";
import { Controller, Get } from "./http/decorators.js";
import { Injectable, inject } from "@decorify/di";
import { Container } from "@decorify/di";
import { LifecycleManager } from "./lifecycle/manager.js";
import type { HttpAdapter } from "./adapters/http-adapter.js";
import type { HttpContext } from "./context.js";
import {
  UseGuard,
  UseMiddleware,
  UseFilter,
} from "./http/middleware-decorator.js";
import type { Guard, ExceptionFilter } from "./types.js";

describe("Router", () => {
  let container: Container;
  let mockAdapter: any;
  let mockLifecycle: any;

  beforeEach(() => {
    container = new Container();
    mockAdapter = {
      registerRoute: vi.fn(),
      listen: vi.fn(),
      close: vi.fn(),
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
      container,
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
      container,
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
      container,
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
      status: vi.fn().mockReturnThis(),
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
      container,
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
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as HttpContext;

    await handler(mockCtx);

    // ctx.json should be called by the ExceptionFilter with a 403 error
    expect(mockCtx.status).toHaveBeenCalledWith(403);
    expect(mockCtx.json).toHaveBeenCalledWith({
      name: "ForbiddenException",
      statusCode: 403,
      message: "Forbidden",
    });
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
      container,
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
      status: vi.fn().mockReturnThis(),
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

  it("should not auto-serialize json if responseSent is true", async () => {
    @Injectable()
    @Controller()
    class MyController {
      @Get("/")
      index(ctx: HttpContext) {
        // manually send response proxy
        (ctx as any).responseSent = true;
        return { some: "data" };
      }
    }

    registerControllers(
      container,
      mockAdapter as HttpAdapter,
      [MyController],
      mockLifecycle,
      { globalMiddleware: [], globalGuards: [], globalFilters: [] },
    );

    const handler = mockAdapter.registerRoute.mock.calls[0][2];
    const mockCtx = {
      responseSent: false,
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as HttpContext;

    await handler(mockCtx);

    // ctx.json should NOT be called because responseSent became true
    expect(mockCtx.json).not.toHaveBeenCalled();
  });

  it("should act as a last resort catch if all exception filters fail", async () => {
    const errorThrowingGuard = {
      canActivate: async () => {
        throw new Error("Guard failed");
      },
    };

    // Filter that also fails
    const failingFilter = {
      catch: async () => {
        throw new Error("Filter failed");
      },
    };

    @Injectable()
    @Controller()
    @UseGuard(errorThrowingGuard)
    class MyController {
      @Get("/")
      index() {}
    }

    registerControllers(
      container,
      mockAdapter as HttpAdapter,
      [MyController],
      mockLifecycle,
      {
        globalMiddleware: [],
        globalGuards: [],
        globalFilters: [failingFilter],
      },
    );

    const handler = mockAdapter.registerRoute.mock.calls[0][2];

    const mockStatusFn = vi.fn().mockReturnThis();
    const mockJsonFn = vi.fn();
    const mockCtx = {
      responseSent: false,
      status: mockStatusFn,
      json: mockJsonFn,
    } as unknown as HttpContext;

    // Suppress console.error for this test since it intentionally outputs one
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await handler(mockCtx);

    // Our fallback should have triggered 500 status
    expect(mockStatusFn).toHaveBeenCalledWith(500);
    expect(mockJsonFn).toHaveBeenCalledWith({
      statusCode: 500,
      message: "Internal Server Error",
    });

    consoleSpy.mockRestore();
  });

  it("should resolve constructor-based guards via DI container", async () => {
    const mockService = { isValid: vi.fn().mockReturnValue(false) };

    @Injectable()
    class GuardService {
      check() {
        return mockService.isValid();
      }
    }

    @Injectable()
    class MyGuard implements Guard {
      private service = inject(GuardService);
      canActivate() {
        return this.service.check();
      }
    }

    @Injectable()
    @Controller()
    @UseGuard(MyGuard)
    class MyController {
      @Get("/")
      index() {
        return "ok";
      }
    }

    registerControllers(
      container,
      mockAdapter as HttpAdapter,
      [MyController],
      mockLifecycle,
      { globalMiddleware: [], globalGuards: [], globalFilters: [] },
    );

    const handler = mockAdapter.registerRoute.mock.calls[0][2];
    const mockCtx = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as HttpContext;

    await handler(mockCtx);

    expect(mockService.isValid).toHaveBeenCalled();
    // Handler logic shouldn't be executed, instead ExceptionFilter kicks in
    expect(mockCtx.status).toHaveBeenCalledWith(403);
    expect(mockCtx.json).toHaveBeenCalledWith({
      name: "ForbiddenException",
      statusCode: 403,
      message: "Forbidden",
    });
  });

  it("should resolve constructor-based exception filters via DI container", async () => {
    const mockMonitor = { logError: vi.fn() };

    @Injectable()
    class MonitorService {
      log(err: Error) {
        mockMonitor.logError(err.message);
      }
    }

    @Injectable()
    class MyFilter implements ExceptionFilter {
      private monitor = inject(MonitorService);
      catch(error: Error, ctx: HttpContext) {
        this.monitor.log(error);
        ctx.status(400).json({ customError: true });
      }
    }

    @Injectable()
    @Controller()
    @UseFilter(MyFilter)
    class MyController {
      @Get("/")
      index() {
        throw new Error("Controller failure");
      }
    }

    registerControllers(
      container,
      mockAdapter as HttpAdapter,
      [MyController],
      mockLifecycle,
      { globalMiddleware: [], globalGuards: [], globalFilters: [] },
    );

    const handler = mockAdapter.registerRoute.mock.calls[0][2];
    const mockCtx = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as HttpContext;

    await handler(mockCtx);

    expect(mockMonitor.logError).toHaveBeenCalledWith("Controller failure");
    expect(mockCtx.status).toHaveBeenCalledWith(400);
    expect(mockCtx.json).toHaveBeenCalledWith({ customError: true });
  });
});
