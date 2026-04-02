import { describe, it, expect } from "vitest";
import { Module } from "./decorator.js";
import { IS_MODULE, MODULE_METADATA } from "./metadata.js";
import { Injectable } from "@decorify/di";

describe("@Module() decorator", () => {
  it("stores IS_MODULE = true in class metadata", () => {
    @Module({})
    class AppModule {}

    expect((AppModule as any)[Symbol.metadata][IS_MODULE]).toBe(true);
  });

  it("stores MODULE_METADATA containing the provided options", () => {
    @Injectable()
    class TestService {}

    class TestController {}

    const metadata = {
      controllers: [TestController],
      providers: [TestService],
    };

    @Module(metadata)
    class AppModule {}

    const stored = (AppModule as any)[Symbol.metadata][MODULE_METADATA];
    expect(stored).toBe(metadata);
  });

  it("works with empty metadata @Module({})", () => {
    @Module({})
    class EmptyModule {}

    const meta = (EmptyModule as any)[Symbol.metadata];
    expect(meta[IS_MODULE]).toBe(true);
    expect(meta[MODULE_METADATA]).toEqual({});
  });

  it("stores correct controllers array in metadata", () => {
    class ControllerA {}
    class ControllerB {}

    @Module({ controllers: [ControllerA, ControllerB] })
    class AppModule {}

    const stored = (AppModule as any)[Symbol.metadata][MODULE_METADATA];
    expect(stored.controllers).toEqual([ControllerA, ControllerB]);
  });

  it("stores correct providers array in metadata", () => {
    @Injectable()
    class ServiceA {}

    @Injectable()
    class ServiceB {}

    @Module({ providers: [ServiceA, ServiceB] })
    class AppModule {}

    const stored = (AppModule as any)[Symbol.metadata][MODULE_METADATA];
    expect(stored.providers).toEqual([ServiceA, ServiceB]);
  });

  it("stores correct imports array in metadata", () => {
    @Module({})
    class SubModule {}

    @Module({ imports: [SubModule] })
    class AppModule {}

    const stored = (AppModule as any)[Symbol.metadata][MODULE_METADATA];
    expect(stored.imports).toEqual([SubModule]);
  });

  it("stores correct exports array in metadata", () => {
    @Injectable()
    class SharedService {}

    @Module({ exports: [SharedService] })
    class AppModule {}

    const stored = (AppModule as any)[Symbol.metadata][MODULE_METADATA];
    expect(stored.exports).toEqual([SharedService]);
  });

  it("stores all four arrays when fully specified", () => {
    @Injectable()
    class ProviderA {}

    class ControllerA {}

    @Module({})
    class ImportedModule {}

    @Module({
      imports: [ImportedModule],
      controllers: [ControllerA],
      providers: [ProviderA],
      exports: [ProviderA],
    })
    class FullModule {}

    const stored = (FullModule as any)[Symbol.metadata][MODULE_METADATA];
    expect(stored.imports).toEqual([ImportedModule]);
    expect(stored.controllers).toEqual([ControllerA]);
    expect(stored.providers).toEqual([ProviderA]);
    expect(stored.exports).toEqual([ProviderA]);
  });

  it("throws when applied to a non-class", () => {
    expect(() => {
      const decorator = Module({});
      // Simulate applying to a non-class context
      decorator(undefined, {
        kind: "method",
        name: "foo",
        metadata: {},
      } as any);
    }).toThrow("@Module can only be used on classes.");
  });
});
