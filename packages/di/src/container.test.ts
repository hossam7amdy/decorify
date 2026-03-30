import { describe, it, expect, beforeEach, vi } from "vitest";
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

  describe("double registration guard", () => {
    it("should throw when registering the same token twice", () => {
      class MyService {}
      container.register(MyService);
      expect(() => container.register(MyService)).toThrow(
        '[DI] Token "MyService" is already registered. Pass { override: true } to replace it.',
      );
    });

    it("should allow override with { override: true }", () => {
      class MyService {
        version = 1;
      }
      class MyServiceV2 {
        version = 2;
      }
      container.register(MyService);
      container.register(MyService, MyServiceV2, { override: true });
      const instance = container.resolve(MyService);
      expect(instance).toBeInstanceOf(MyServiceV2);
    });

    it("should guard symbol tokens against double registration", () => {
      const token = Symbol("MyToken");
      class Impl {}
      container.register(token, Impl);
      expect(() => container.register(token, Impl)).toThrow(
        "is already registered",
      );
    });

    it("should guard string tokens against double registration", () => {
      const token = "myToken";
      class Impl {}
      container.register(token, Impl);
      expect(() => container.register(token, Impl)).toThrow(
        "is already registered",
      );
    });
  });

  describe("circular dependency detection", () => {
    it("should detect A → B → A cycle", () => {
      class B {}
      class A {
        b = container.resolve(B);
      }
      // B depends on A
      class BImpl {
        a = container.resolve(A);
      }

      container.register(A);
      container.register(B, BImpl);

      expect(() => container.resolve(A)).toThrow(
        "[DI] Circular dependency detected: A → B → A",
      );
    });

    it("should detect A → B → C → A cycle", () => {
      const tokenA = "A";
      const tokenB = "B";
      const tokenC = "C";

      class ServiceC {
        a = container.resolve(tokenA);
      }
      class ServiceB {
        c = container.resolve(tokenC);
      }
      class ServiceA {
        b = container.resolve(tokenB);
      }

      container.register(tokenA, ServiceA);
      container.register(tokenB, ServiceB);
      container.register(tokenC, ServiceC);

      expect(() => container.resolve(tokenA)).toThrow(
        "[DI] Circular dependency detected: A → B → C → A",
      );
    });

    it("should not throw for cached singleton dependencies", () => {
      class Dep {}
      class MyService {
        dep = container.resolve(Dep);
      }

      container.register(Dep);
      container.register(MyService);

      // Resolve Dep first so it's cached
      container.resolve(Dep);

      // Now resolving MyService should work — Dep is cached
      expect(() => container.resolve(MyService)).not.toThrow();
    });
  });

  describe("lifetime scopes", () => {
    it("should resolve singleton as same instance (default)", () => {
      class MyService {}
      container.register(MyService);
      expect(container.resolve(MyService)).toBe(container.resolve(MyService));
    });

    it("should resolve transient as new instance each time", () => {
      class MyService {}
      container.register(MyService, { lifetime: "transient" });
      const a = container.resolve(MyService);
      const b = container.resolve(MyService);
      expect(a).toBeInstanceOf(MyService);
      expect(a).not.toBe(b);
    });

    it("should throw when resolving scoped token from root container", () => {
      class MyService {}
      container.register(MyService, { lifetime: "scoped" });
      expect(() => container.resolve(MyService)).toThrow(
        'Cannot resolve scoped token "MyService" from root container. Use createScope().',
      );
    });

    it("should resolve scoped token as singleton within a scope", () => {
      class MyService {}
      container.register(MyService, { lifetime: "scoped" });
      const scope = container.createScope();
      const a = scope.resolve(MyService);
      const b = scope.resolve(MyService);
      expect(a).toBe(b);
    });

    it("should resolve scoped token as different instances across scopes", () => {
      class MyService {}
      container.register(MyService, { lifetime: "scoped" });
      const scope1 = container.createScope();
      const scope2 = container.createScope();
      expect(scope1.resolve(MyService)).not.toBe(scope2.resolve(MyService));
    });

    it("should resolve singleton in child as same instance from root", () => {
      class MyService {}
      container.register(MyService);
      const rootInstance = container.resolve(MyService);
      const scope = container.createScope();
      expect(scope.resolve(MyService)).toBe(rootInstance);
    });

    it("should resolve transient in child as new instance each time", () => {
      class MyService {}
      container.register(MyService, { lifetime: "transient" });
      const scope = container.createScope();
      const a = scope.resolve(MyService);
      const b = scope.resolve(MyService);
      expect(a).not.toBe(b);
    });
  });

  describe("value provider", () => {
    it("should return the exact value reference", () => {
      const token = Symbol("config");
      const config = { port: 3000 };
      container.registerValue(token, config);
      expect(container.resolve(token)).toBe(config);
    });

    it("should guard against double registration", () => {
      const token = Symbol("val");
      container.registerValue(token, 1);
      expect(() => container.registerValue(token, 2)).toThrow(
        "is already registered",
      );
    });

    it("should allow override with { override: true }", () => {
      const token = Symbol("val");
      container.registerValue(token, 1);
      container.registerValue(token, 2, { override: true });
      expect(container.resolve(token)).toBe(2);
    });
  });

  describe("factory provider", () => {
    it("should call factory once for singleton lifetime", () => {
      const token = Symbol("factory");
      const factory = vi.fn(() => ({ id: Math.random() }));
      container.registerFactory(token, factory);

      const a = container.resolve(token);
      const b = container.resolve(token);
      expect(a).toBe(b);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should call factory each time for transient lifetime", () => {
      const token = Symbol("factory");
      const factory = vi.fn(() => ({ id: Math.random() }));
      container.registerFactory(token, factory, { lifetime: "transient" });

      const a = container.resolve(token);
      const b = container.resolve(token);
      expect(a).not.toBe(b);
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it("should support scoped factory in child container", () => {
      const token = Symbol("factory");
      container.registerFactory(token, () => ({ id: Math.random() }), {
        lifetime: "scoped",
      });

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      expect(scope1.resolve(token)).toBe(scope1.resolve(token));
      expect(scope1.resolve(token)).not.toBe(scope2.resolve(token));
    });

    it("should guard against double registration", () => {
      const token = Symbol("factory");
      container.registerFactory(token, () => 1);
      expect(() => container.registerFactory(token, () => 2)).toThrow(
        "is already registered",
      );
    });

    it("should have injection context active during factory call", () => {
      class Dep {}
      container.register(Dep);

      const token = Symbol("factory");
      container.registerFactory(token, () => ({
        dep: container.resolve(Dep),
        hadContext: container.isInInjectionContext,
      }));

      const instance = container.resolve<{ dep: Dep; hadContext: boolean }>(
        token,
      );
      expect(instance.dep).toBeInstanceOf(Dep);
      expect(instance.hadContext).toBe(true);
    });
  });

  describe("validate", () => {
    it("should not throw when all tokens are registered", () => {
      class A {}
      class B {}
      container.register(A);
      container.register(B);
      expect(() => container.validate([A, B])).not.toThrow();
    });

    it("should throw listing one missing token", () => {
      class A {}
      class Missing {}
      container.register(A);
      expect(() => container.validate([A, Missing])).toThrow(
        "[DI] Missing registrations: Missing",
      );
    });

    it("should throw listing all missing tokens", () => {
      class A {}
      class B {}
      expect(() => container.validate([A, B])).toThrow(
        "[DI] Missing registrations: A, B",
      );
    });

    it("should not throw for empty array", () => {
      expect(() => container.validate([])).not.toThrow();
    });
  });

  describe("captive dependency detection", () => {
    it("should throw when singleton depends on transient", () => {
      class Transient {}
      class Singleton {
        dep = container.resolve(Transient);
      }

      container.register(Transient, { lifetime: "transient" });
      container.register(Singleton);

      expect(() => container.resolve(Singleton)).toThrow(
        '[DI] Captive dependency detected: singleton "Singleton" depends on transient "Transient"',
      );
    });

    it("should throw when scoped depends on transient", () => {
      class Transient {}
      class Scoped {
        dep = container.resolve(Transient);
      }

      container.register(Transient, { lifetime: "transient" });
      container.register(Scoped, { lifetime: "scoped" });

      const scope = container.createScope();
      expect(() => scope.resolve(Scoped)).toThrow(
        '[DI] Captive dependency detected: scoped "Scoped" depends on transient "Transient"',
      );
    });

    it("should throw when singleton factory depends on transient", () => {
      class Transient {}
      container.register(Transient, { lifetime: "transient" });

      const token = Symbol("singletonFactory");
      container.registerFactory(token, () => ({
        dep: container.resolve(Transient),
      }));

      expect(() => container.resolve(token)).toThrow(
        "Captive dependency detected",
      );
    });

    it("should allow singleton depends on singleton", () => {
      class DepSingleton {}
      class Singleton {
        dep = container.resolve(DepSingleton);
      }

      container.register(DepSingleton);
      container.register(Singleton);

      expect(() => container.resolve(Singleton)).not.toThrow();
    });

    it("should allow scoped depends on singleton", () => {
      class Singleton {}
      class Scoped {
        dep = container.resolve(Singleton);
      }

      container.register(Singleton);
      container.register(Scoped, { lifetime: "scoped" });

      const scope = container.createScope();
      expect(() => scope.resolve(Scoped)).not.toThrow();
    });

    it("should allow transient depends on singleton", () => {
      class Singleton {}
      class Transient {
        dep = container.resolve(Singleton);
      }

      container.register(Singleton);
      container.register(Transient, { lifetime: "transient" });

      expect(() => container.resolve(Transient)).not.toThrow();
    });

    it("should allow transient depends on transient", () => {
      class DepTransient {}
      class Transient {
        dep = container.resolve(DepTransient);
      }

      container.register(DepTransient, { lifetime: "transient" });
      container.register(Transient, { lifetime: "transient" });

      expect(() => container.resolve(Transient)).not.toThrow();
    });
  });

  describe("resolveAsync", () => {
    it("should call init() on instance with init method", async () => {
      const initFn = vi.fn(async () => {});
      class MyService {
        init = initFn;
      }
      container.register(MyService);

      await container.resolveAsync(MyService);
      expect(initFn).toHaveBeenCalledTimes(1);
    });

    it("should call init() only once for singleton", async () => {
      const initFn = vi.fn(async () => {});
      class MyService {
        init = initFn;
      }
      container.register(MyService);

      const a = await container.resolveAsync(MyService);
      const b = await container.resolveAsync(MyService);
      expect(initFn).toHaveBeenCalledTimes(1);
      expect(a).toBe(b);
    });

    it("should call init() each time for transient", async () => {
      const initFn = vi.fn(async () => {});
      const token = Symbol("svc");
      container.registerFactory(token, () => ({ init: initFn }), {
        lifetime: "transient",
      });

      const a = await container.resolveAsync(token);
      const b = await container.resolveAsync(token);
      expect(initFn).toHaveBeenCalledTimes(2);
      expect(a).not.toBe(b);
    });

    it("should work for instances without init method", async () => {
      class MyService {
        value = 42;
      }
      container.register(MyService);

      const instance = await container.resolveAsync(MyService);
      expect(instance).toBeInstanceOf(MyService);
      expect(instance.value).toBe(42);
    });

    it("should propagate init() errors", async () => {
      class MyService {
        async init() {
          throw new Error("init failed");
        }
      }
      container.register(MyService);

      await expect(container.resolveAsync(MyService)).rejects.toThrow(
        "init failed",
      );
    });
  });
});
