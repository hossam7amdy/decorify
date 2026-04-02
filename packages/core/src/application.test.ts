import { describe, it, expect, vi, beforeEach } from "vitest";
import { Application } from "./application.js";
import { Module } from "./module/decorator.js";
import { Controller, Get } from "./http/decorators.js";
import { Injectable } from "@decorify/di";

describe("Application", () => {
  let mockAdapter: any;

  beforeEach(() => {
    mockAdapter = {
      registerRoute: vi.fn(),
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      useMiddleware: vi.fn(),
      useErrorHandler: vi.fn(),
      getInstance: vi.fn(),
    };
  });

  it("should create application with root module", async () => {
    @Module({})
    class AppModule {}

    const app = await Application.create(AppModule, mockAdapter);
    expect(app).toBeInstanceOf(Application);
  });

  it("should call adapter.listen when app.listen() is called", async () => {
    @Module({})
    class AppModule {}

    const app = await Application.create(AppModule, mockAdapter);
    const callback = () => {};
    await app.listen(3000, callback);
    expect(mockAdapter.listen).toHaveBeenCalledWith(3000, callback);
  });

  it("should call adapter.close when app.close() is called", async () => {
    @Module({})
    class AppModule {}

    const app = await Application.create(AppModule, mockAdapter);
    await app.close();
    expect(mockAdapter.close).toHaveBeenCalled();
  });

  it("should register routes from module controllers", async () => {
    @Controller("/test")
    class TestController {
      @Get("/")
      index() {
        return "ok";
      }
    }

    @Module({ controllers: [TestController] })
    class AppModule {}

    const app = await Application.create(AppModule, mockAdapter);
    await app.listen(3000);
    expect(mockAdapter.registerRoute).toHaveBeenCalled();
  });

  it("should support global middleware, guards, and filters", async () => {
    @Module({})
    class AppModule {}

    const mw = async () => {};
    const guard = { canActivate: async () => true };
    const filter = { catch: async () => {} };

    const app = await Application.create(AppModule, mockAdapter);
    app.useMiddleware(mw).useGlobalGuard(guard).useGlobalFilter(filter);

    expect(app["globalGuards"]).toHaveLength(1);
    expect(app["globalFilters"]).toHaveLength(1);
    expect(app["globalMiddleware"]).toHaveLength(1);
  });

  it("should return the adapter via getAdapter()", async () => {
    @Module({})
    class AppModule {}

    const app = await Application.create(AppModule, mockAdapter);
    expect(app.getAdapter()).toBe(mockAdapter);
  });

  it("should throw when root module is not decorated with @Module", async () => {
    class NotAModule {}

    await expect(Application.create(NotAModule, mockAdapter)).rejects.toThrow(
      "Did you forget @Module()?",
    );
  });

  it("should collect controllers from imported modules", async () => {
    @Injectable()
    class SharedService {}

    @Controller("/shared")
    class SharedController {
      @Get("/")
      index() {
        return "shared";
      }
    }

    @Module({ controllers: [SharedController], providers: [SharedService] })
    class SharedModule {}

    @Module({ imports: [SharedModule] })
    class AppModule {}

    const app = await Application.create(AppModule, mockAdapter);
    await app.listen(3000);
    expect(mockAdapter.registerRoute).toHaveBeenCalled();
  });
});
