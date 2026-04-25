import { describe, it, expect } from "vitest";
import { DI_INJECTABLE, DI_LIFETIME, Lifetime } from "@decorify/di";
import { Controller, CONTROLLER_META } from "./controller.ts";

describe("@Controller", () => {
  it("stores prefix in Symbol.metadata[CONTROLLER_META]", () => {
    @Controller("/api")
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    expect(meta[CONTROLLER_META]).toEqual({ prefix: "/api" });
  });

  it("stores undefined prefix when called without arguments", () => {
    @Controller()
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    expect(meta[CONTROLLER_META]).toEqual({ prefix: undefined });
  });

  it("sets DI_INJECTABLE metadata to true", () => {
    @Controller("/test")
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    expect(meta[DI_INJECTABLE]).toBe(true);
  });

  it("sets DI_LIFETIME metadata to SINGLETON", () => {
    @Controller("/test")
    class TestCtrl {}

    const meta = (TestCtrl as any)[Symbol.metadata];
    expect(meta[DI_LIFETIME]).toBe(Lifetime.SINGLETON);
  });
});
