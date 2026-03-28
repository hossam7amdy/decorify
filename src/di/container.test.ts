import { describe, it, expect, beforeEach } from "vitest";
import { container } from "./container.js";

describe("DI Container", () => {
  beforeEach(() => {
    container.clear();
  });

  it("should register and resolve a token", () => {
    class MyService {}
    container.register(MyService);
    const instance = container.resolve(MyService);
    expect(instance).toBeInstanceOf(MyService);
  });

  it("should resolve as singleton", () => {
    class MyService {}
    container.register(MyService);
    const instance1 = container.resolve(MyService);
    const instance2 = container.resolve(MyService);
    expect(instance1).toBe(instance2);
  });

  it("should throw error if provider is not registered", () => {
    class UnregisteredService {}
    expect(() => container.resolve(UnregisteredService)).toThrow(
      "[DI] No provider registered for UnregisteredService",
    );
  });

  it("should support custom target for tokens (abstract class)", () => {
    abstract class MyBase {}
    class MyServiceImpl extends MyBase {}

    container.register(MyBase, MyServiceImpl);
    const instance = container.resolve(MyBase);

    expect(instance).toBeInstanceOf(MyServiceImpl);
  });

  it("should support custom target for tokens (symbol)", () => {
    const token = Symbol("MyToken");
    class MyServiceImpl {}

    container.register(token, MyServiceImpl);
    const instance = container.resolve(token);

    expect(instance).toBeInstanceOf(MyServiceImpl);
  });

  it("should support custom target for tokens (string)", () => {
    const token = "MyToken";
    class MyServiceImpl {}

    container.register(token, MyServiceImpl);
    const instance = container.resolve(token);

    expect(instance).toBeInstanceOf(MyServiceImpl);
  });

  it("should throw if the token is not a function", () => {
    const token = "MyToken";
    expect(() => container.register(token)).toThrow("[DI] Invalid token");
  });

  it("should track injection context", () => {
    expect(container.isInInjectionContext).toBe(false);

    class MyService {
      constructor() {
        expect(container.isInInjectionContext).toBe(true);
      }
    }

    container.register(MyService);
    container.resolve(MyService);

    expect(container.isInInjectionContext).toBe(false);
  });
});
