import { describe, it, expect, vi, beforeEach } from "vitest";
import { Application } from "./application.js";
import { Controller } from "./http/decorators.js";
import { Injectable } from "@decorify/di";

describe("Application", () => {
  let mockAdapter: any;

  beforeEach(() => {
    mockAdapter = {
      registerRoute: vi.fn(),
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      getInstance: vi.fn(),
    };
  });

  it("should register controllers", async () => {
    @Injectable()
    @Controller("/")
    class MyController {}

    const app = await Application.create(mockAdapter, {
      controllers: [MyController],
    });

    expect(app["controllers"]).toHaveLength(1);
    expect(app["controllers"][0]).toBe(MyController);
  });

  it("should call adapter.listen when app.listen() is called", async () => {
    const app = await Application.create(mockAdapter, {
      controllers: [],
    });
    const callback = () => {};
    await app.listen(3000, callback);
    expect(mockAdapter.listen).toHaveBeenCalledWith(3000, callback);
  });

  it("should call adapter.close when app.close() is called", async () => {
    const app = await Application.create(mockAdapter, {
      controllers: [],
    });
    await app.close();
    expect(mockAdapter.close).toHaveBeenCalled();
  });

  it("should support global middleware, guards, and filters", async () => {
    const mw = async () => {};
    const guard = { canActivate: async () => true };
    const filter = { catch: async () => {} };

    @Injectable()
    @Controller("/")
    class MyController {}

    const app = await Application.create(mockAdapter, {
      controllers: [MyController],
    });
    app.useMiddleware(mw).useGlobalGuard(guard).useGlobalFilter(filter);

    expect(app["globalGuards"]).toHaveLength(1);
    expect(app["globalFilters"]).toHaveLength(1);
    expect(app["globalMiddleware"]).toHaveLength(1);
  });

  it("should return the adapter via app.adapter", async () => {
    const app = await Application.create(mockAdapter, {
      controllers: [],
    });
    expect(app.adapter).toBe(mockAdapter);
  });

  it("should initialize and dispose the DI container during lifecycle", async () => {
    const app = await Application.create(mockAdapter, {
      controllers: [],
    });

    const initSpy = vi.spyOn(app["container"], "initialize");
    const disposeSpy = vi.spyOn(app["container"], "dispose");

    await app.init();
    expect(initSpy).toHaveBeenCalled();

    await app.close();
    expect(disposeSpy).toHaveBeenCalled();
  });

  it("should track all resolved DI instances for lifecycle hooks", async () => {
    @Injectable()
    class MyService {
      onInit() {}
    }

    const app = await Application.create(mockAdapter, {
      controllers: [],
    });

    app["container"].register(MyService);
    const instance = app["container"].resolve(MyService);

    const trackSpy = vi.spyOn(app["lifecycle"], "track");

    await app.init();

    expect(trackSpy).toHaveBeenCalledWith(instance);
  });
});
