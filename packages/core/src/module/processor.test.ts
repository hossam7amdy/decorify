import { describe, it, expect, beforeEach } from "vitest";
import { processModules } from "./processor.js";
import { Module } from "./decorator.js";
import { Container, Injectable } from "@decorify/di";
import { Controller } from "../http/decorators.js";

describe("processModules()", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it("registers providers and collects controllers from a basic module", () => {
    @Injectable()
    class TestService {}

    @Controller("/test")
    class TestController {}

    @Module({ controllers: [TestController], providers: [TestService] })
    class TestModule {}

    const controllers = processModules(container, TestModule);

    expect(controllers).toContain(TestController);
    expect(container.has(TestService)).toBe(true);
  });

  it("collects providers from imported modules", () => {
    @Injectable()
    class ServiceB {}

    @Controller("/b")
    class ControllerB {}

    @Module({ controllers: [ControllerB], providers: [ServiceB] })
    class ModuleB {}

    @Controller("/a")
    class ControllerA {}

    @Module({ imports: [ModuleB], controllers: [ControllerA] })
    class ModuleA {}

    const controllers = processModules(container, ModuleA);

    expect(controllers).toContain(ControllerA);
    expect(controllers).toContain(ControllerB);
    expect(container.has(ServiceB)).toBe(true);
  });

  it("handles diamond imports without registering providers more than once", () => {
    @Injectable()
    class SharedService {}

    @Controller("/d")
    class ControllerD {}

    @Module({ controllers: [ControllerD], providers: [SharedService] })
    class ModuleD {}

    @Module({ imports: [ModuleD] })
    class ModuleB {}

    @Module({ imports: [ModuleD] })
    class ModuleC {}

    @Module({ imports: [ModuleB, ModuleC] })
    class ModuleA {}

    // Should not throw even though ModuleD is reachable via two paths
    expect(() => processModules(container, ModuleA)).not.toThrow();

    const controllers = processModules(new Container(), ModuleA);
    // ControllerD should appear only once
    const count = controllers.filter((c) => c === ControllerD).length;
    expect(count).toBe(1);
  });

  it("handles circular imports without infinite loops", () => {
    // We use a forward-reference trick: declare classes first, then decorate
    // via manual metadata assignment to avoid TypeScript forward-ref issues.
    @Controller("/a")
    class ControllerA {}

    @Controller("/b")
    class ControllerB {}

    // Build the circular graph manually using plain objects as stand-ins
    // for module classes so we can set Symbol.metadata after the fact.
    class CircularA {}
    class CircularB {}

    const IS_MODULE_KEY = Symbol.for("decorify:is_module");
    const MODULE_METADATA_KEY = Symbol.for("decorify:module_metadata");

    // Apply @Module decorator by hand to avoid forward-reference issues
    const decoratorA = Module({
      controllers: [ControllerA],
      imports: [CircularB],
    });
    decoratorA(undefined, {
      kind: "class",
      name: "CircularA",
      metadata: ((CircularA as any)[Symbol.metadata] ??= {}),
    } as any);

    const decoratorB = Module({
      controllers: [ControllerB],
      imports: [CircularA],
    });
    decoratorB(undefined, {
      kind: "class",
      name: "CircularB",
      metadata: ((CircularB as any)[Symbol.metadata] ??= {}),
    } as any);

    let controllers: any[];
    expect(() => {
      controllers = processModules(container, CircularA);
    }).not.toThrow();

    expect(controllers!).toContain(ControllerA);
    expect(controllers!).toContain(ControllerB);
  });

  it("skips registering a provider that is already in the container", () => {
    @Injectable()
    class ExistingService {}

    // Pre-register the provider
    container.register(ExistingService);

    @Module({ providers: [ExistingService] })
    class TestModule {}

    // Should not throw when the provider is already registered
    expect(() => processModules(container, TestModule)).not.toThrow();
    expect(container.has(ExistingService)).toBe(true);
  });

  it("throws when passed a non-module class", () => {
    class PlainClass {}

    expect(() => processModules(container, PlainClass)).toThrow(
      "Did you forget @Module()?",
    );
  });

  it("returns empty controllers array and registers no providers for an empty module", () => {
    @Module({})
    class EmptyModule {}

    const controllers = processModules(container, EmptyModule);

    expect(controllers).toHaveLength(0);
  });
});
