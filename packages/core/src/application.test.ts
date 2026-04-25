import { describe, it, expect, vi, beforeEach } from "vitest";
import { Container, InjectionToken } from "@decorify/di";
import { Application } from "./application.ts";
import type { HttpAdapter, RouteDefinition } from "./http/adapter.ts";
import type { HttpContext, HttpResponse } from "./http/context.ts";
import type { ModuleDefinition } from "./module.ts";
import type { Middleware } from "./middleware.ts";
import { Controller } from "./decorators/controller.ts";
import { Get, Post, Delete } from "./decorators/route.ts";
import { UseMiddleware } from "./decorators/middleware.ts";
import { HttpException } from "./errors/http-exception.ts";

// --- Mock HttpAdapter ---
function createMockAdapter(): HttpAdapter & {
  listenCalls: Array<{ port: number; host?: string }>;
  closeCalled: boolean;
  routes: RouteDefinition[];
} {
  const adapter = {
    routes: [] as RouteDefinition[],
    listenCalls: [] as Array<{ port: number; host?: string }>,
    closeCalled: false,
    native: {},
    registerRoute(route: RouteDefinition): void {
      adapter.routes.push({
        method: route.method,
        path: route.path,
        handler: route.handler,
      });
    },
    async listen(port: number, host?: string): Promise<number> {
      adapter.listenCalls.push({ port, host });
      return port;
    },
    async close(): Promise<void> {
      adapter.closeCalled = true;
    },
  };
  return adapter;
}

// --- Mock HttpContext ---
function createMockCtx(
  overrides: Partial<{ method: string; path: string; sent: boolean }> = {},
): HttpContext & {
  res: HttpResponse & { _statusCode: number; _jsonData: unknown };
} {
  let statusCode = 200;
  let sent = overrides.sent ?? false;
  let jsonData: unknown;

  const res: any = {
    get sent() {
      return sent;
    },
    status(code: number) {
      statusCode = code;
      return res;
    },
    header: vi.fn().mockReturnThis(),
    async send(body?: string | Buffer | Uint8Array) {
      sent = true;
    },
    async json(data: unknown) {
      jsonData = data;
      sent = true;
    },
    async stream() {
      sent = true;
    },
    async redirect() {
      sent = true;
    },
    async end() {
      sent = true;
    },
    get _statusCode() {
      return statusCode;
    },
    get _jsonData() {
      return jsonData;
    },
  };

  return {
    req: {
      method: overrides.method ?? "GET",
      path: overrides.path ?? "/",
      url: overrides.path ?? "/",
      headers: {},
      query: {},
      params: {},
      body: () => Promise.resolve({}),
    },
    res,
    state: new Map(),
    raw: { req: {}, res: {} },
  } as any;
}

// --- Test controllers and modules ---
@Controller("/items")
class ItemController {
  @Get("/")
  getAll() {
    return [{ id: 1, name: "item1" }];
  }

  @Post("/")
  create() {
    return { id: 2, name: "item2" };
  }

  @Delete("/:id")
  remove() {
    return undefined;
  }
}

describe("Application", () => {
  let adapter: ReturnType<typeof createMockAdapter>;

  beforeEach(() => {
    adapter = createMockAdapter();
  });

  describe("Application.create()", () => {
    it("creates an application and registers routes on the adapter", async () => {
      const mod: ModuleDefinition = {
        name: "ItemModule",
        controllers: [ItemController],
      };

      const app = await Application.create({
        adapter,
        modules: [mod],
      });

      expect(app.getRoutes()).toHaveLength(3);
      expect(app.getRoutes().map((r) => r.method)).toEqual([
        "GET",
        "POST",
        "DELETE",
      ]);
    });

    it("registers providers from all modules into the container", async () => {
      const container = new Container();
      const registerSpy = vi.spyOn(container, "register");

      const provider = {
        provide: new InjectionToken("DB_URL"),
        useValue: "postgres://localhost",
      };

      const mod: ModuleDefinition = {
        name: "ConfigModule",
        providers: [provider],
      };

      await Application.create({
        adapter,
        container,
        modules: [mod],
      });

      expect(registerSpy).toHaveBeenCalledWith(provider);
    });

    it("warns when controller has no metadata", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      class PlainClass {}

      const mod: ModuleDefinition = {
        name: "BadModule",
        controllers: [PlainClass as any],
      };

      const app = await Application.create({
        adapter,
        modules: [mod],
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("PlainClass"),
      );
      expect(app.getRoutes()).toHaveLength(0);
      warnSpy.mockRestore();
    });
  });

  describe("joinPath (tested via route registration)", () => {
    it("produces /prefix/path for controller with prefix", async () => {
      const mod: ModuleDefinition = {
        name: "ItemModule",
        controllers: [ItemController],
      };

      const app = await Application.create({
        adapter,
        modules: [mod],
      });

      const paths = app.getRoutes().map((r) => r.path);
      expect(paths).toContain("/items");
      expect(paths).toContain("/items/:id");
    });

    it("produces /path for controller without prefix", async () => {
      @Controller()
      class RootCtrl {
        @Get("/health")
        health() {
          return "ok";
        }
      }

      const mod: ModuleDefinition = {
        name: "RootModule",
        controllers: [RootCtrl],
      };

      const app = await Application.create({
        adapter,
        modules: [mod],
      });

      expect(app.getRoutes().at(0)?.path).toBe("/health");
    });
  });

  describe("resolve()", () => {
    it("delegates to the container", async () => {
      const container = new Container();
      const myToken = new InjectionToken("MY_TOKEN");
      container.register({
        provide: myToken,
        useValue: 42,
      });

      const app = await Application.create({
        adapter,
        container,
        modules: [],
      });

      expect(app.resolve(myToken)).toBe(42);
    });
  });

  describe("listen()", () => {
    it("delegates to adapter", async () => {
      const app = await Application.create({
        adapter,
        modules: [],
      });

      await app.listen(3000, "0.0.0.0");
      expect(adapter.listenCalls).toEqual([{ port: 3000, host: "0.0.0.0" }]);
    });
  });

  describe("close()", () => {
    it("calls adapter.close() and container.dispose()", async () => {
      const container = new Container();
      const disposeSpy = vi.spyOn(container, "dispose");

      const app = await Application.create({
        adapter,
        container,
        modules: [],
      });

      await app.close();
      expect(adapter.closeCalled).toBe(true);
      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe("response convention", () => {
    it("return value is sent as JSON via ctx.res.json()", async () => {
      @Controller("/test")
      class JsonCtrl {
        @Get("/data")
        getData() {
          return { foo: "bar" };
        }
      }

      const mod: ModuleDefinition = {
        name: "JsonModule",
        controllers: [JsonCtrl],
      };

      await Application.create({ adapter, modules: [mod] });

      const route = adapter.routes.find((r) => r.path === "/test/data");
      expect(route).toBeDefined();

      const ctx = createMockCtx({ method: "GET", path: "/test/data" });
      await route!.handler(ctx);

      expect(ctx.res._jsonData).toEqual({ foo: "bar" });
    });

    it("undefined return results in 204 and end()", async () => {
      @Controller("/test")
      class NoContentCtrl {
        @Delete("/thing")
        deleteThing() {
          return undefined;
        }
      }

      const mod: ModuleDefinition = {
        name: "NoContentModule",
        controllers: [NoContentCtrl],
      };

      await Application.create({ adapter, modules: [mod] });

      const route = adapter.routes.find((r) => r.path === "/test/thing");
      const ctx = createMockCtx({ method: "DELETE", path: "/test/thing" });
      await route!.handler(ctx);

      expect(ctx.res._statusCode).toBe(204);
    });

    it("skips response when ctx.res.sent is true", async () => {
      @Controller("/test")
      class SentCtrl {
        @Get("/sent")
        alreadySent(ctx: HttpContext) {
          ctx.res.send("manual");
          return "ignored";
        }
      }

      const mod: ModuleDefinition = {
        name: "SentModule",
        controllers: [SentCtrl],
      };

      await Application.create({ adapter, modules: [mod] });

      const route = adapter.routes.find((r) => r.path === "/test/sent");
      const ctx = createMockCtx({ method: "GET", path: "/test/sent" });
      await route!.handler(ctx);

      // After send, sent is true, so json should not be called with "ignored"
      // The handler called send("manual"), so sent becomes true
      expect(ctx.res.sent).toBe(true);
    });
  });

  describe("error handling", () => {
    it("default error handler handles HttpException", async () => {
      @Controller("/err")
      class ErrCtrl {
        @Get("/not-found")
        notFound() {
          throw new HttpException(404, "Not found");
        }
      }

      const mod: ModuleDefinition = {
        name: "ErrModule",
        controllers: [ErrCtrl],
      };

      await Application.create({ adapter, modules: [mod] });

      const route = adapter.routes.find((r) => r.path === "/err/not-found");
      const ctx = createMockCtx({ method: "GET", path: "/err/not-found" });
      await route!.handler(ctx);

      expect(ctx.res._statusCode).toBe(404);
      expect(ctx.res._jsonData).toMatchObject({
        status: 404,
        message: "Not found",
      });
    });

    it("default error handler handles generic errors with 500", async () => {
      @Controller("/err")
      class GenericErrCtrl {
        @Get("/generic")
        fail() {
          throw new Error("oops");
        }
      }

      const mod: ModuleDefinition = {
        name: "GenericErrModule",
        controllers: [GenericErrCtrl],
      };

      await Application.create({ adapter, modules: [mod] });

      const route = adapter.routes.find((r) => r.path === "/err/generic");
      const ctx = createMockCtx({ method: "GET", path: "/err/generic" });
      await route!.handler(ctx);

      expect(ctx.res._statusCode).toBe(500);
      expect(ctx.res._jsonData).toMatchObject({ error: "oops" });
    });

    it("custom error handler is called on throw", async () => {
      const customHandler = vi.fn();

      @Controller("/custom-err")
      class CustomErrCtrl {
        @Get("/boom")
        boom() {
          throw new Error("boom");
        }
      }

      const mod: ModuleDefinition = {
        name: "CustomErrModule",
        controllers: [CustomErrCtrl],
      };

      await Application.create({
        adapter,
        modules: [mod],
        errorHandler: customHandler,
      });

      const route = adapter.routes.find((r) => r.path === "/custom-err/boom");
      const ctx = createMockCtx({ method: "GET", path: "/custom-err/boom" });
      await route!.handler(ctx);

      expect(customHandler).toHaveBeenCalledWith(expect.any(Error), ctx);
      expect((customHandler.mock.calls[0]![0] as Error).message).toBe("boom");
    });
  });

  describe("middleware ordering", () => {
    it("flattens global + module + controller + route middleware in correct order", async () => {
      const order: string[] = [];

      const globalMw: Middleware = async (_ctx, next) => {
        order.push("global");
        await next();
      };
      const moduleMw: Middleware = async (_ctx, next) => {
        order.push("module");
        await next();
      };
      const controllerMw: Middleware = async (_ctx, next) => {
        order.push("controller");
        await next();
      };
      const routeMw: Middleware = async (_ctx, next) => {
        order.push("route");
        await next();
      };

      @Controller("/mw-test")
      @UseMiddleware(controllerMw)
      class MwCtrl {
        @Get("/ordered")
        @UseMiddleware(routeMw)
        handler() {
          order.push("handler");
          return "ok";
        }
      }

      const mod: ModuleDefinition = {
        name: "MwModule",
        controllers: [MwCtrl],
        middlewares: [moduleMw],
      };

      await Application.create({
        adapter,
        modules: [mod],
        globalMiddleware: [globalMw],
      });

      const route = adapter.routes.find((r) => r.path === "/mw-test/ordered");
      const ctx = createMockCtx({
        method: "GET",
        path: "/mw-test/ordered",
      });
      await route!.handler(ctx);

      expect(order).toEqual([
        "global",
        "module",
        "controller",
        "route",
        "handler",
      ]);
    });
  });

  describe("getAdapter()", () => {
    it("returns the adapter instance", async () => {
      const app = await Application.create({
        adapter,
        modules: [],
      });

      expect(app.getAdapter()).toBe(adapter);
    });
  });

  describe("multiple modules", () => {
    it("registers controllers from multiple modules", async () => {
      @Controller("/a")
      class CtrlA {
        @Get("/one")
        one() {
          return "a1";
        }
      }

      @Controller("/b")
      class CtrlB {
        @Get("/two")
        two() {
          return "b2";
        }
      }

      const modA: ModuleDefinition = {
        name: "ModA",
        controllers: [CtrlA],
      };
      const modB: ModuleDefinition = {
        name: "ModB",
        controllers: [CtrlB],
      };

      await Application.create({ adapter, modules: [modA, modB] });

      expect(adapter.routes).toHaveLength(2);
      expect(adapter.routes.map((r) => r.path)).toEqual(["/a/one", "/b/two"]);
    });
  });
});
