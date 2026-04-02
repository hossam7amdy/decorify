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
      useMiddleware: vi.fn(),
      useErrorHandler: vi.fn(),
      getInstance: vi.fn(),
    };
  });

  it("should register controllers", async () => {
    @Injectable()
    @Controller("/")
    class MyController {}

    const app = await Application.create([MyController], mockAdapter);

    expect(app["controllers"]).toHaveLength(1);
    expect(app["controllers"][0]).toBe(MyController);
  });

  it("should call adapter.listen when app.listen() is called", async () => {
    const app = await Application.create([], mockAdapter);
    const callback = () => {};
    await app.listen(3000, callback);
    expect(mockAdapter.listen).toHaveBeenCalledWith(3000, callback);
  });

  it("should call adapter.close when app.close() is called", async () => {
    const app = await Application.create([], mockAdapter);
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

    const app = await Application.create([MyController], mockAdapter);
    app.useMiddleware(mw).useGlobalGuard(guard).useGlobalFilter(filter);

    expect(app["globalGuards"]).toHaveLength(1);
    expect(app["globalFilters"]).toHaveLength(1);
    expect(app["globalMiddleware"]).toHaveLength(1);
  });

  it("should return the adapter via getAdapter()", async () => {
    const app = await Application.create([], mockAdapter);
    expect(app.getAdapter()).toBe(mockAdapter);
  });
});
