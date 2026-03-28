import { describe, it, expect, vi, beforeEach } from "vitest";
import { Application } from "./application.js";
import { container } from "./di/container.js";
import { Controller } from "./http/decorators.js";
import { Injectable } from "./di/decorators.js";

describe("Application", () => {
  let mockAdapter: any;
  let app: Application;

  beforeEach(() => {
    container.clear();
    mockAdapter = {
      registerRoute: vi.fn(),
      listen: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      useMiddleware: vi.fn(),
      useErrorHandler: vi.fn(),
      getInstance: vi.fn(),
    };
    app = new Application(mockAdapter);
  });

  it("should register controllers", () => {
    @Injectable()
    @Controller("/")
    class MyController {}

    app.register([MyController]);

    expect(app["controllers"]).toHaveLength(1);
    expect(app["controllers"][0]).toBe(MyController);
  });

  it("should call adapter.listen when app.listen() is called", async () => {
    const callback = () => {};
    await app.listen(3000, callback);
    expect(mockAdapter.listen).toHaveBeenCalledWith(3000, callback);
  });

  it("should call adapter.close when app.close() is called", async () => {
    await app.close();
    expect(mockAdapter.close).toHaveBeenCalled();
  });

  it("should support global middleware, guards, and filters", async () => {
    const mw = async () => {};
    const guard = { canActivate: async () => true };
    const filter = { catch: async () => {} };

    app.useMiddleware(mw).useGlobalGuard(guard).useGlobalFilter(filter);

    @Injectable()
    @Controller("/")
    class MyController {}
    app.register([MyController]);

    expect(app["globalGuards"]).toHaveLength(1);
    expect(app["globalFilters"]).toHaveLength(1);
    expect(app["globalMiddleware"]).toHaveLength(1);
  });

  it("should return the adapter via getAdapter()", () => {
    expect(app.getAdapter()).toBe(mockAdapter);
  });
});
