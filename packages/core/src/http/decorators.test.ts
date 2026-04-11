import { describe, it, expect } from "vitest";
import {
  Controller,
  Get,
  Post,
  ValidateBody,
  ValidateParams,
  ValidateQuery,
  Validate,
} from "./decorators.js";

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

  describe("Validation Decorators", () => {
    const mockSchema = { "~standard": { version: 1, vendor: "mock" } } as any;

    it("@ValidateBody should set methodBodySchemas in metadata", () => {
      class TestController {
        @ValidateBody(mockSchema)
        index() {}
      }

      const metadata = (TestController as any)[Symbol.metadata];
      expect(metadata.methodBodySchemas.get("index")).toBe(mockSchema);
    });

    it("@ValidateParams should set methodParamsSchemas in metadata", () => {
      class TestController {
        @ValidateParams(mockSchema)
        index() {}
      }

      const metadata = (TestController as any)[Symbol.metadata];
      expect(metadata.methodParamsSchemas.get("index")).toBe(mockSchema);
    });

    it("@ValidateQuery should set methodQuerySchemas in metadata", () => {
      class TestController {
        @ValidateQuery(mockSchema)
        index() {}
      }

      const metadata = (TestController as any)[Symbol.metadata];
      expect(metadata.methodQuerySchemas.get("index")).toBe(mockSchema);
    });

    it("@Validate shorthand should set multiple schemas in metadata", () => {
      const bodySchema = { ...mockSchema };
      const paramSchema = { ...mockSchema };

      class TestController {
        @Validate({ body: bodySchema, params: paramSchema })
        index() {}
      }

      const metadata = (TestController as any)[Symbol.metadata];
      expect(metadata.methodBodySchemas.get("index")).toBe(bodySchema);
      expect(metadata.methodParamsSchemas.get("index")).toBe(paramSchema);
      expect(metadata.methodQuerySchemas?.get("index")).toBeUndefined();
    });

    it("should throw error if @ValidateBody is used on a class", () => {
      expect(() => {
        @ValidateBody(mockSchema)
        class Bad {}
      }).toThrow("@methodBodySchemas can only be used on methods.");
    });
  });
});
