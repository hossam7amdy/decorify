import { describe, it, expect } from "vitest";
import { Controller, Get, Post } from "./decorators.js";

describe("HTTP Decorators", () => {
  it("@Controller should set basePath in metadata", () => {
    @Controller("/test")
    class TestController {}

    const metadata = (TestController as any)[Symbol.metadata];
    expect(metadata.basePath).toBe("/test");
  });

  it("@Get should add route to metadata", () => {
    class TestController {
      @Get("/hello")
      index() {}
    }

    const metadata = (TestController as any)[Symbol.metadata];
    expect(metadata.routes).toContainEqual({
      method: "get",
      path: "/hello",
      handlerName: "index",
    });
  });

  it("@Post should add route to metadata", () => {
    class TestController {
      @Post("/create")
      create() {}
    }

    const metadata = (TestController as any)[Symbol.metadata];
    expect(metadata.routes).toContainEqual({
      method: "post",
      path: "/create",
      handlerName: "create",
    });
  });

  it("should support multiple routes on a class", () => {
    class TestController {
      @Get("/list")
      list() {}

      @Post("/add")
      add() {}
    }

    const metadata = (TestController as any)[Symbol.metadata];
    expect(metadata.routes).toHaveLength(2);
    expect(metadata.routes).toContainEqual({
      method: "get",
      path: "/list",
      handlerName: "list",
    });
    expect(metadata.routes).toContainEqual({
      method: "post",
      path: "/add",
      handlerName: "add",
    });
  });

  it("should throw error if @Get is used on a class", () => {
    expect(() => {
      @Get("/bad")
      class Bad {}
    }).toThrow("@GET can only be used on methods.");
  });
});
