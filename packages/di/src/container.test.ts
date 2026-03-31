import { describe, it, expect, beforeEach, vi } from "vitest";
import { Container } from "./container.js";
import { InjectionToken, Scope } from "./types.js";
import { inject } from "./context.js";

describe("DI Container", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe("Basic registration & resolution", () => {
    it("should register and resolve a class", () => {
      class MyService {}
      container.register(MyService);
      const instance = container.resolve(MyService);
      expect(instance).toBeInstanceOf(MyService);
    });

    it("should resolve as singleton by default", () => {
      class MyService {}
      container.register(MyService);
      expect(container.resolve(MyService)).toBe(container.resolve(MyService));
    });

    it("should throw if provider is not registered", () => {
      class Unregistered {}
      expect(() => container.resolve(Unregistered)).toThrow(
        "[DI] No provider registered for Unregistered",
      );
    });

    it("should support custom target via ClassProvider", () => {
      class MyBase {}
      class MyServiceImpl extends MyBase {}

      container.register({ provide: MyBase, useClass: MyServiceImpl });
      const instance = container.resolve(MyBase);

      expect(instance).toBeInstanceOf(MyServiceImpl);
    });

    it("should support InjectionToken for non-class tokens", () => {
      const TOKEN = new InjectionToken<string>("greeting");
      container.register({ provide: TOKEN, useValue: "hello" });
      expect(container.resolve(TOKEN)).toBe("hello");
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

  describe("register", () => {
    it("should accept a bare constructor", () => {
      class Svc {}
      container.register(Svc);
      expect(container.resolve(Svc)).toBeInstanceOf(Svc);
    });

    it("should accept a ClassProvider", () => {
      class Base {}
      class Impl extends Base {}
      container.register({ provide: Base, useClass: Impl });
      expect(container.resolve(Base)).toBeInstanceOf(Impl);
    });

    it("should accept a ValueProvider", () => {
      const TOKEN = new InjectionToken<number>("port");
      container.register({ provide: TOKEN, useValue: 3000 });
      expect(container.resolve(TOKEN)).toBe(3000);
    });

    it("should accept a FactoryProvider", () => {
      const TOKEN = new InjectionToken<{ id: number }>("obj");
      container.register({
        provide: TOKEN,
        useFactory: () => ({ id: 42 }),
      });
      expect(container.resolve(TOKEN)).toEqual({ id: 42 });
    });

    it("should accept an ExistingProvider (alias)", () => {
      class Original {}
      const ALIAS = new InjectionToken<Original>("alias");

      container.register(Original);
      container.register({ provide: ALIAS, useExisting: Original });

      expect(container.resolve(ALIAS)).toBe(container.resolve(Original));
    });

    it("should throw for provider missing a strategy", () => {
      const TOKEN = new InjectionToken("bad");
      expect(() =>
        container.register({ provide: TOKEN } as any),
      ).toThrow(
        '[DI] Provider for "InjectionToken(bad)" is missing a strategy',
      );
    });
  });

  describe("registerMany", () => {
    it("should register multiple providers at once", () => {
      class A {}
      class B {}
      container.registerMany([A, B]);
      expect(container.resolve(A)).toBeInstanceOf(A);
      expect(container.resolve(B)).toBeInstanceOf(B);
    });

    it("should leave earlier registrations intact on partial failure", () => {
      class A {}
      class B {}
      container.register(B); // pre-register B to cause duplicate error

      expect(() => container.registerMany([A, B])).toThrow("is already registered");
      // A was registered before B threw
      expect(container.has(A)).toBe(true);
    });
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
      container.register(
        { provide: MyService, useClass: MyServiceV2 },
        { override: true },
      );
      const instance = container.resolve(MyService);
      expect(instance).toBeInstanceOf(MyServiceV2);
    });

    it("should guard InjectionToken against double registration", () => {
      const token = new InjectionToken("myToken");
      class Impl {}
      container.register({ provide: token, useClass: Impl });
      expect(() =>
        container.register({ provide: token, useClass: Impl }),
      ).toThrow("is already registered");
    });
  });

  describe("inject() in constructors", () => {
    it("should resolve via inject() during construction", () => {
      class Dep {
        value = 99;
      }
      class MyService {
        dep = inject(Dep);
      }

      container.register(Dep);
      container.register(MyService);

      const svc = container.resolve(MyService);
      expect(svc.dep).toBeInstanceOf(Dep);
      expect(svc.dep.value).toBe(99);
    });

    it("should resolve nested inject() chains", () => {
      class C {
        value = "c";
      }
      class B {
        c = inject(C);
      }
      class A {
        b = inject(B);
      }

      container.registerMany([A, B, C]);
      const a = container.resolve(A);
      expect(a.b.c.value).toBe("c");
    });
  });

  describe("circular dependency detection", () => {
    it("should detect A → B → A cycle", () => {
      class B {}
      class A {
        b = inject(B);
      }
      class BImpl {
        a = inject(A);
      }

      container.register(A);
      container.register({ provide: B, useClass: BImpl });

      expect(() => container.resolve(A)).toThrow(
        "[DI] Circular dependency detected: A → B → A",
      );
    });

    it("should detect A → B → C → A cycle", () => {
      const tokenA = new InjectionToken("A");
      const tokenB = new InjectionToken("B");
      const tokenC = new InjectionToken("C");

      class ServiceC {
        a = inject(tokenA);
      }
      class ServiceB {
        c = inject(tokenC);
      }
      class ServiceA {
        b = inject(tokenB);
      }

      container.register({ provide: tokenA, useClass: ServiceA });
      container.register({ provide: tokenB, useClass: ServiceB });
      container.register({ provide: tokenC, useClass: ServiceC });

      expect(() => container.resolve(tokenA)).toThrow(
        "[DI] Circular dependency detected: InjectionToken(A) → InjectionToken(B) → InjectionToken(C) → InjectionToken(A)",
      );
    });

    it("should not throw for cached singleton dependencies", () => {
      class Dep {}
      class MyService {
        dep = inject(Dep);
      }

      container.register(Dep);
      container.register(MyService);

      container.resolve(Dep);

      expect(() => container.resolve(MyService)).not.toThrow();
    });

    it("should detect cycles via container.resolve() in constructors", () => {
      class B {}
      class A {
        b = container.resolve(B);
      }
      class BImpl {
        a = container.resolve(A);
      }

      container.register(A);
      container.register({ provide: B, useClass: BImpl });

      expect(() => container.resolve(A)).toThrow(
        "[DI] Circular dependency detected: A → B → A",
      );
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
      container.register({
        provide: MyService,
        useClass: MyService,
        scope: Scope.Transient,
      });
      const a = container.resolve(MyService);
      const b = container.resolve(MyService);
      expect(a).toBeInstanceOf(MyService);
      expect(a).not.toBe(b);
    });

    it("should throw when resolving scoped token from root container", () => {
      class MyService {}
      container.register({
        provide: MyService,
        useClass: MyService,
        scope: Scope.Scoped,
      });
      expect(() => container.resolve(MyService)).toThrow(
        'Cannot resolve scoped token "MyService" from root container. Use createScope().',
      );
    });

    it("should resolve scoped token as singleton within a scope", () => {
      class MyService {}
      container.register({
        provide: MyService,
        useClass: MyService,
        scope: Scope.Scoped,
      });
      const scope = container.createScope();
      const a = scope.resolve(MyService);
      const b = scope.resolve(MyService);
      expect(a).toBe(b);
    });

    it("should resolve scoped token as different instances across scopes", () => {
      class MyService {}
      container.register({
        provide: MyService,
        useClass: MyService,
        scope: Scope.Scoped,
      });
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
      container.register({
        provide: MyService,
        useClass: MyService,
        scope: Scope.Transient,
      });
      const scope = container.createScope();
      const a = scope.resolve(MyService);
      const b = scope.resolve(MyService);
      expect(a).not.toBe(b);
    });

    it("should allow child scope to register scoped overrides", () => {
      const TOKEN = new InjectionToken<string>("greeting");
      container.register({
        provide: TOKEN,
        useValue: "root",
        scope: Scope.Scoped,
      });

      const scope = container.createScope();
      scope.register(
        { provide: TOKEN, useValue: "child", scope: Scope.Scoped },
        { override: true },
      );

      expect(scope.resolve(TOKEN)).toBe("child");
    });

    it("should delegate singleton resolution to parent even if child overrides", () => {
      class Base {
        name = "base";
      }
      class Override {
        name = "override";
      }
      container.register(Base);

      const scope = container.createScope();
      scope.register(
        { provide: Base, useClass: Override },
        { override: true },
      );

      // Singleton always resolves from root — child override is ignored
      expect(scope.resolve(Base).name).toBe("base");
    });
  });

  describe("value provider", () => {
    it("should return the exact value reference", () => {
      const token = new InjectionToken<{ port: number }>("config");
      const config = { port: 3000 };
      container.register({ provide: token, useValue: config });
      expect(container.resolve(token)).toBe(config);
    });

    it("should support falsy values", () => {
      const zero = new InjectionToken<number>("zero");
      const empty = new InjectionToken<string>("empty");
      const nul = new InjectionToken<null>("null");
      const undef = new InjectionToken<undefined>("undef");
      const bool = new InjectionToken<boolean>("false");

      container.register({ provide: zero, useValue: 0 });
      container.register({ provide: empty, useValue: "" });
      container.register({ provide: nul, useValue: null });
      container.register({ provide: undef, useValue: undefined });
      container.register({ provide: bool, useValue: false });

      expect(container.resolve(zero)).toBe(0);
      expect(container.resolve(empty)).toBe("");
      expect(container.resolve(nul)).toBe(null);
      expect(container.resolve(undef)).toBe(undefined);
      expect(container.resolve(bool)).toBe(false);
    });

    it("should guard against double registration", () => {
      const token = new InjectionToken<number>("val");
      container.register({ provide: token, useValue: 1 });
      expect(() => container.register({ provide: token, useValue: 2 })).toThrow(
        "is already registered",
      );
    });

    it("should allow override with { override: true }", () => {
      const token = new InjectionToken<number>("val");
      container.register({ provide: token, useValue: 1 });
      container.register({ provide: token, useValue: 2 }, { override: true });
      expect(container.resolve(token)).toBe(2);
    });
  });

  describe("factory provider", () => {
    it("should call factory once for singleton scope", () => {
      const token = new InjectionToken<{ id: number }>("factory");
      const factory = vi.fn(() => ({ id: Math.random() }));
      container.register({ provide: token, useFactory: factory });

      const a = container.resolve(token);
      const b = container.resolve(token);
      expect(a).toBe(b);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should call factory each time for transient scope", () => {
      const token = new InjectionToken<{ id: number }>("factory");
      const factory = vi.fn(() => ({ id: Math.random() }));
      container.register({
        provide: token,
        useFactory: factory,
        scope: Scope.Transient,
      });

      const a = container.resolve(token);
      const b = container.resolve(token);
      expect(a).not.toBe(b);
      expect(factory).toHaveBeenCalledTimes(2);
    });

    it("should support scoped factory in child container", () => {
      const token = new InjectionToken<{ id: number }>("factory");
      container.register({
        provide: token,
        useFactory: () => ({ id: Math.random() }),
        scope: Scope.Scoped,
      });

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      expect(scope1.resolve(token)).toBe(scope1.resolve(token));
      expect(scope1.resolve(token)).not.toBe(scope2.resolve(token));
    });

    it("should guard against double registration", () => {
      const token = new InjectionToken("factory");
      container.register({ provide: token, useFactory: () => 1 });
      expect(() =>
        container.register({ provide: token, useFactory: () => 2 }),
      ).toThrow("is already registered");
    });

    it("should have injection context active during factory call", () => {
      class Dep {}
      container.register(Dep);

      const token = new InjectionToken<{ dep: Dep; hadContext: boolean }>(
        "factory",
      );
      container.register({
        provide: token,
        useFactory: () => ({
          dep: inject(Dep),
          hadContext: container.isInInjectionContext,
        }),
      });

      const instance = container.resolve(token);
      expect(instance.dep).toBeInstanceOf(Dep);
      expect(instance.hadContext).toBe(true);
    });

    it("should throw if factory returns a Promise", () => {
      const token = new InjectionToken("asyncBad");
      container.register({
        provide: token,
        useFactory: (() => Promise.resolve("value")) as any,
      });

      expect(() => container.resolve(token)).toThrow(
        "returned a Promise",
      );
    });
  });

  describe("existing provider", () => {
    it("should resolve alias to the original token", () => {
      class Original {
        value = "original";
      }
      const ALIAS = new InjectionToken<Original>("alias");

      container.register(Original);
      container.register({ provide: ALIAS, useExisting: Original });

      const fromAlias = container.resolve(ALIAS);
      const fromOriginal = container.resolve(Original);
      expect(fromAlias).toBe(fromOriginal);
    });

    it("should follow alias chains", () => {
      class Impl {
        value = 42;
      }
      const ALIAS1 = new InjectionToken<Impl>("alias1");
      const ALIAS2 = new InjectionToken<Impl>("alias2");

      container.register(Impl);
      container.register({ provide: ALIAS1, useExisting: Impl });
      container.register({ provide: ALIAS2, useExisting: ALIAS1 });

      expect(container.resolve(ALIAS2)).toBe(container.resolve(Impl));
    });

    it("should detect circular aliases", () => {
      const A = new InjectionToken("A");
      const B = new InjectionToken("B");

      container.register({ provide: A, useExisting: B });
      container.register({ provide: B, useExisting: A });

      expect(() => container.resolve(A)).toThrow(
        "[DI] Circular dependency detected",
      );
    });
  });

  describe("has", () => {
    it("should return true for registered tokens", () => {
      class Svc {}
      container.register(Svc);
      expect(container.has(Svc)).toBe(true);
    });

    it("should return false for unregistered tokens", () => {
      class Svc {}
      expect(container.has(Svc)).toBe(false);
    });

    it("should find tokens registered in parent", () => {
      class Svc {}
      container.register(Svc);
      const child = container.createScope();
      expect(child.has(Svc)).toBe(true);
    });
  });

  describe("validate", () => {
    it("should not throw when all tokens are registered", () => {
      class A {}
      class B {}
      container.registerMany([A, B]);
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
        dep = inject(Transient);
      }

      container.register({
        provide: Transient,
        useClass: Transient,
        scope: Scope.Transient,
      });
      container.register(Singleton);

      expect(() => container.resolve(Singleton)).toThrow(
        '[DI] Captive dependency detected: singleton "Singleton" depends on transient "Transient"',
      );
    });

    it("should throw when scoped depends on transient", () => {
      class Transient {}
      class Scoped {
        dep = inject(Transient);
      }

      container.register({
        provide: Transient,
        useClass: Transient,
        scope: Scope.Transient,
      });
      container.register({
        provide: Scoped,
        useClass: Scoped,
        scope: Scope.Scoped,
      });

      const scope = container.createScope();
      expect(() => scope.resolve(Scoped)).toThrow(
        '[DI] Captive dependency detected: scoped "Scoped" depends on transient "Transient"',
      );
    });

    it("should throw when singleton factory depends on transient", () => {
      class Transient {}
      container.register({
        provide: Transient,
        useClass: Transient,
        scope: Scope.Transient,
      });

      const token = new InjectionToken("singletonFactory");
      container.register({
        provide: token,
        useFactory: () => ({
          dep: inject(Transient),
        }),
      });

      expect(() => container.resolve(token)).toThrow(
        "Captive dependency detected",
      );
    });

    it("should allow singleton depends on singleton", () => {
      class DepSingleton {}
      class Singleton {
        dep = inject(DepSingleton);
      }

      container.register(DepSingleton);
      container.register(Singleton);

      expect(() => container.resolve(Singleton)).not.toThrow();
    });

    it("should allow scoped depends on singleton", () => {
      class Singleton {}
      class Scoped {
        dep = inject(Singleton);
      }

      container.register(Singleton);
      container.register({
        provide: Scoped,
        useClass: Scoped,
        scope: Scope.Scoped,
      });

      const scope = container.createScope();
      expect(() => scope.resolve(Scoped)).not.toThrow();
    });

    it("should allow transient depends on singleton", () => {
      class Singleton {}
      class Transient {
        dep = inject(Singleton);
      }

      container.register(Singleton);
      container.register({
        provide: Transient,
        useClass: Transient,
        scope: Scope.Transient,
      });

      expect(() => container.resolve(Transient)).not.toThrow();
    });

    it("should allow transient depends on transient", () => {
      class DepTransient {}
      class Transient {
        dep = inject(DepTransient);
      }

      container.register({
        provide: DepTransient,
        useClass: DepTransient,
        scope: Scope.Transient,
      });
      container.register({
        provide: Transient,
        useClass: Transient,
        scope: Scope.Transient,
      });

      expect(() => container.resolve(Transient)).not.toThrow();
    });
  });

  describe("clear", () => {
    it("should allow re-registration after clear", () => {
      class Svc {
        version = 1;
      }
      container.register(Svc);
      const first = container.resolve(Svc);

      container.clear();

      class SvcV2 {
        version = 2;
      }
      container.register({ provide: Svc, useClass: SvcV2 });
      const second = container.resolve(Svc);

      expect(first.version).toBe(1);
      expect(second.version).toBe(2);
    });

    it("should clear cached instances so new resolve creates fresh ones", () => {
      class Svc {}
      container.register(Svc);
      const before = container.resolve(Svc);

      container.clear();
      container.register(Svc);
      const after = container.resolve(Svc);

      expect(before).not.toBe(after);
    });
  });
});
