import { describe, it, expect, beforeEach, vi } from "vitest";
import { Container } from "./container.js";
import { InjectionToken } from "./injection-token.js";
import { Lifetime } from "./lifetime.js";
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
      expect(() => container.register({ provide: TOKEN } as any)).toThrow(
        '[DI] Provider for "InjectionToken(bad)" is missing a strategy',
      );
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

      container.register(A);
      container.register(B);
      container.register(C);
      const a = container.resolve(A);
      expect(a.b.c.value).toBe("c");
    });

    it("singleton factory using inject() should resolve deps from root, not from calling child", () => {
      const SINGLETON = new InjectionToken("SINGLETON");
      const CONFIG = new InjectionToken("CONFIG");

      container.register({
        provide: CONFIG,
        useValue: "root-config",
      });

      container.register({
        provide: SINGLETON,
        useFactory: () => {
          const config = inject(CONFIG);
          return { config };
        },
        lifetime: Lifetime.SINGLETON,
      });

      const child = container.createScope();
      // Child overrides CONFIG with a scoped factory
      child.register(
        {
          provide: CONFIG,
          useFactory: () => "child-config",
          lifetime: Lifetime.SCOPED,
        },
        { override: true },
      );

      const instance = child.resolve(SINGLETON);

      expect(instance.config).toBe("root-config");
    });

    it("grandchild scope: singleton captures dependency two levels down", () => {
      const SINGLETON = new InjectionToken("SINGLETON");
      const CONFIG = new InjectionToken("CONFIG");

      container.register({ provide: CONFIG, useValue: "root-config" });

      container.register({
        provide: SINGLETON,
        useFactory: () => ({ config: inject(CONFIG) }),
        lifetime: Lifetime.SINGLETON,
      });

      const child = container.createScope();
      const grandchild = child.createScope();

      grandchild.register(
        {
          provide: CONFIG,
          useFactory: () => "grandchild-config",
          lifetime: Lifetime.SCOPED,
        },
        { override: true },
      );

      const instance = grandchild.resolve(SINGLETON) as { config: string };

      expect(instance.config).toBe("root-config");
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
        lifetime: Lifetime.TRANSIENT,
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
        lifetime: Lifetime.SCOPED,
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
        lifetime: Lifetime.SCOPED,
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
        lifetime: Lifetime.SCOPED,
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
        lifetime: Lifetime.TRANSIENT,
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
        useFactory: () => "root",
        lifetime: Lifetime.SCOPED,
      });

      const scope = container.createScope();
      scope.register(
        {
          provide: TOKEN,
          useFactory: () => "child",
          lifetime: Lifetime.SCOPED,
        },
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
      scope.register({ provide: Base, useClass: Override }, { override: true });

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
        lifetime: Lifetime.TRANSIENT,
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
        lifetime: Lifetime.SCOPED,
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

      expect(() => container.resolve(token)).toThrow("returned a Promise");
    });

    it("should resolve deps using inject() inside factory", () => {
      const A = new InjectionToken<string>("a");
      const B = new InjectionToken<number>("b");
      const RESULT = new InjectionToken<string>("result");

      container.register({ provide: A, useValue: "hello" });
      container.register({ provide: B, useValue: 42 });
      container.register({
        provide: RESULT,
        useFactory: () => `${inject(A)}-${inject(B)}`,
      });

      expect(container.resolve(RESULT)).toBe("hello-42");
    });

    it("should throw when inject() inside factory targets unregistered token", () => {
      const MISSING = new InjectionToken<string>("missing");
      const TOKEN = new InjectionToken<string>("result");

      container.register({
        provide: TOKEN,
        useFactory: () => inject(MISSING),
      });

      expect(() => container.resolve(TOKEN)).toThrow(
        "No provider registered for InjectionToken(missing)",
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

  describe("captive dependency detection", () => {
    it("should throw when singleton depends on transient", () => {
      class Transient {}
      class Singleton {
        dep = inject(Transient);
      }

      container.register({
        provide: Transient,
        useClass: Transient,
        lifetime: Lifetime.TRANSIENT,
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
        lifetime: Lifetime.TRANSIENT,
      });
      container.register({
        provide: Scoped,
        useClass: Scoped,
        lifetime: Lifetime.SCOPED,
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
        lifetime: Lifetime.TRANSIENT,
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
        lifetime: Lifetime.SCOPED,
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
        lifetime: Lifetime.TRANSIENT,
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
        lifetime: Lifetime.TRANSIENT,
      });
      container.register({
        provide: Transient,
        useClass: Transient,
        lifetime: Lifetime.TRANSIENT,
      });

      expect(() => container.resolve(Transient)).not.toThrow();
    });
  });

  describe("dispose", () => {
    function makeScopedProvider(token: any, lifetime = Lifetime.SCOPED) {
      return { provide: token, useClass: token, lifetime };
    }

    it("should allow disposing the root container asynchronously", async () => {
      await expect(container.dispose()).resolves.toBeUndefined();
    });

    it("should be idempotent — calling dispose twice does not throw", async () => {
      const scope = container.createScope();
      await scope.dispose();
      await expect(scope.dispose()).resolves.toBeUndefined();
    });

    it("should call Symbol.asyncDispose on root singleton instances", async () => {
      const spy = vi.fn();
      class Svc {
        async [Symbol.asyncDispose]() {
          spy();
        }
      }
      container.register(Svc);
      container.resolve(Svc);

      await container.dispose();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should call Symbol.asyncDispose on cached instances", async () => {
      const spy = vi.fn();
      class Svc {
        async [Symbol.asyncDispose]() {
          spy();
        }
      }
      container.register(makeScopedProvider(Svc));
      const scope = container.createScope();
      scope.resolve(Svc);

      await scope.dispose();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should fall back to Symbol.dispose when Symbol.asyncDispose is absent", async () => {
      const spy = vi.fn();
      class Svc {
        [Symbol.dispose]() {
          spy();
        }
      }
      container.register(makeScopedProvider(Svc));
      const scope = container.createScope();
      scope.resolve(Svc);

      await scope.dispose();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("should dispose async in reverse resolution order", async () => {
      const order: string[] = [];

      class A {
        async [Symbol.asyncDispose]() {
          order.push("A");
        }
      }
      class B {
        async [Symbol.asyncDispose]() {
          order.push("B");
        }
      }
      class C {
        async [Symbol.asyncDispose]() {
          order.push("C");
        }
      }

      container.register(makeScopedProvider(A));
      container.register(makeScopedProvider(B));
      container.register(makeScopedProvider(C));

      const scope = container.createScope();
      scope.resolve(A);
      scope.resolve(B);
      scope.resolve(C);

      await scope.dispose();
      expect(order).toEqual(["C", "B", "A"]);
    });

    it("should throw when resolve() is called after dispose()", async () => {
      class Svc {}
      container.register(Svc);
      await container.dispose();

      expect(() => container.resolve(Svc)).toThrow(
        "[DI] Container is disposed or being disposed",
      );
    });

    it("should throw when resolveAsync() is called after dispose()", async () => {
      const token = new InjectionToken<string>("str");
      container.register({ provide: token, useValue: "hi" });
      await container.dispose();

      await expect(container.resolveAsync(token)).rejects.toThrow(
        "[DI] Container is disposed or being disposed",
      );
    });

    it("should throw when resolve() is called while dispose() is awaiting", async () => {
      class Svc {}
      container.register(Svc);
      container.resolve(Svc);

      const disposePromise = container.dispose(); // starts disposing; disposed = true
      expect(() => container.resolve(Svc)).toThrow(
        "[DI] Container is disposed or being disposed",
      );
      await disposePromise;
    });

    it("should throw when resolveAsync() is called while dispose() is awaiting", async () => {
      const token = new InjectionToken<string>("str");
      container.register({ provide: token, useValue: "hi" });

      const disposePromise = container.dispose();
      await expect(container.resolveAsync(token)).rejects.toThrow(
        "[DI] Container is disposed or being disposed",
      );
      await disposePromise;
    });

    it("should reject in-flight async factory sub-resolutions started after dispose() begins", async () => {
      // depToken is a dependency resolved mid-factory, AFTER dispose() sets disposed=true.
      // Without the disposed guard in resolveInContextAsync, it would silently add to
      // pendingAsync after Promise.allSettled's snapshot, leaving an undisposed instance.
      const depToken = new InjectionToken<string>("dep");
      const mainToken = new InjectionToken<string>("main");

      let resolveGate!: () => void;
      const gate = new Promise<void>((res) => {
        resolveGate = res;
      });

      container.register({ provide: depToken, useValue: "dep-value" });
      container.register({
        provide: mainToken,
        useFactory: async () => {
          await gate; // pause until dispose() has started
          // This sub-resolution happens after disposed=true — must throw
          return container.resolve(depToken);
        },
      });

      const resolutionPromise = container.resolveAsync(mainToken);

      // Start dispose while the factory is mid-flight (blocked on gate)
      const disposePromise = container.dispose();

      // Unblock the factory — it now tries to resolve depToken on a disposing container
      resolveGate();

      await expect(resolutionPromise).rejects.toThrow(
        "[DI] Container is disposed or being disposed",
      );
      await disposePromise;
    });

    it("should chain errors with SuppressedError in dispose", async () => {
      const err1 = new Error("first");
      const err2 = new Error("second");

      class A {
        async [Symbol.asyncDispose]() {
          throw err1;
        }
      }
      class B {
        async [Symbol.asyncDispose]() {
          throw err2;
        }
      }

      container.register(makeScopedProvider(A));
      container.register(makeScopedProvider(B));

      const scope = container.createScope();
      scope.resolve(A);
      scope.resolve(B);

      try {
        await scope.dispose(); // reverse: B(err2), A(err1)
        expect.unreachable("should have thrown");
      } catch (e) {
        const se = e as SuppressedError;
        expect(se.error).toBe(err1);
        expect(se.suppressed).toBe(err2);
      }
    });
  });

  describe("resolveAsync", () => {
    it("should resolve an async factory", async () => {
      const token = new InjectionToken<string>("async");
      container.register({
        provide: token,
        useFactory: () => Promise.resolve("world"),
      });
      expect(await container.resolveAsync(token)).toBe("world");
    });

    it("should resolve a useExisting alias pointing to an async factory", async () => {
      const BASE = new InjectionToken<string>("base");
      const ALIAS = new InjectionToken<string>("alias");
      container.register({
        provide: BASE,
        useFactory: async () => "base-value",
      });
      container.register({ provide: ALIAS, useExisting: BASE });
      expect(await container.resolveAsync(ALIAS)).toBe("base-value");
    });

    it("should cache singleton across multiple resolveAsync calls", async () => {
      const token = new InjectionToken<object>("singleton");
      container.register({ provide: token, useFactory: async () => ({}) });
      const a = await container.resolveAsync(token);
      const b = await container.resolveAsync(token);
      expect(a).toBe(b);
    });

    it("should call async factory only once for concurrent singleton resolution", async () => {
      const factory = vi.fn(async () => ({}));
      const token = new InjectionToken<object>("concurrent");
      container.register({ provide: token, useFactory: factory });

      const [a, b] = await Promise.all([
        container.resolveAsync(token),
        container.resolveAsync(token),
      ]);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(a).toBe(b);
    });

    it("should return new instance each time for transient async factory", async () => {
      const token = new InjectionToken<object>("transient");
      container.register({
        provide: token,
        useFactory: async () => ({}),
        lifetime: Lifetime.TRANSIENT,
      });
      const a = await container.resolveAsync(token);
      const b = await container.resolveAsync(token);
      expect(a).not.toBe(b);
    });

    it("should resolve async factory using inject() after async deps are primed", async () => {
      const A = new InjectionToken<string>("a");
      const B = new InjectionToken<string>("b");
      const RESULT = new InjectionToken<string>("result");

      container.register({ provide: A, useFactory: async () => "async-a" });
      container.register({ provide: B, useFactory: async () => "async-b" });
      container.register({
        provide: RESULT,
        useFactory: async () => `${inject(A)}+${inject(B)}`,
      });

      await container.resolveAsync(A);
      await container.resolveAsync(B);
      expect(await container.resolveAsync(RESULT)).toBe("async-a+async-b");
    });

    it("should resolve async factory with sync deps using inject()", async () => {
      const DEP = new InjectionToken<string>("dep");
      const RESULT = new InjectionToken<string>("result");

      container.register({ provide: DEP, useValue: "sync-dep" });
      container.register({
        provide: RESULT,
        useFactory: async () => `got-${inject(DEP)}`,
      });

      expect(await container.resolveAsync(RESULT)).toBe("got-sync-dep");
    });

    it("should resolve sync factory using inject() after async dep is primed via resolveAsync()", async () => {
      const ASYNC_DEP = new InjectionToken<string>("asyncDep");
      const SYNC_RESULT = new InjectionToken<string>("syncResult");

      container.register({
        provide: ASYNC_DEP,
        useFactory: async () => "async-val",
      });
      container.register({
        provide: SYNC_RESULT,
        useFactory: () => `sync-${inject(ASYNC_DEP)}`,
      });

      await container.resolveAsync(ASYNC_DEP);
      expect(await container.resolveAsync(SYNC_RESULT)).toBe("sync-async-val");
    });

    it("should make singleton available via sync resolve() after resolveAsync()", async () => {
      const token = new InjectionToken<string>("primed");
      container.register({
        provide: token,
        useFactory: async () => "primed-value",
      });

      await container.resolveAsync(token);
      expect(container.resolve(token)).toBe("primed-value");
    });

    it("should detect circular dependencies in the async path", async () => {
      const A = new InjectionToken<unknown>("A");
      const B = new InjectionToken<unknown>("B");

      container.register({ provide: A, useFactory: () => inject(B) });
      container.register({ provide: B, useFactory: () => inject(A) });

      await expect(container.resolveAsync(A)).rejects.toThrow(
        "Circular dependency detected",
      );
    });

    it("should detect captive dependency in the async path", async () => {
      const SINGLETON_TOKEN = new InjectionToken<unknown>("singleton");
      const TRANSIENT_TOKEN = new InjectionToken<unknown>("transient");

      container.register({
        provide: SINGLETON_TOKEN,
        useFactory: async () => inject(TRANSIENT_TOKEN),
      });
      container.register({
        provide: TRANSIENT_TOKEN,
        useFactory: () => ({}),
        lifetime: Lifetime.TRANSIENT,
      });

      await expect(container.resolveAsync(SINGLETON_TOKEN)).rejects.toThrow(
        "Captive dependency detected",
      );
    });

    it("should resolve singleton async factory via scoped container from parent", async () => {
      const token = new InjectionToken<object>("singletonFromScope");
      container.register({ provide: token, useFactory: async () => ({}) });

      const scope = container.createScope();
      const fromRoot = await container.resolveAsync(token);
      const fromScope = await scope.resolveAsync(token);
      expect(fromRoot).toBe(fromScope);
    });

    it("should resolve scoped async factory within scope", async () => {
      const token = new InjectionToken<object>("scoped");
      container.register({
        provide: token,
        useFactory: async () => ({}),
        lifetime: Lifetime.SCOPED,
      });

      const scope = container.createScope();
      const a = await scope.resolveAsync(token);
      const b = await scope.resolveAsync(token);
      expect(a).toBe(b);
    });

    it("should return different instances across different scopes", async () => {
      const token = new InjectionToken<object>("scoped2");
      container.register({
        provide: token,
        useFactory: async () => ({}),
        lifetime: Lifetime.SCOPED,
      });

      const scope1 = container.createScope();
      const scope2 = container.createScope();
      const a = await scope1.resolveAsync(token);
      const b = await scope2.resolveAsync(token);
      expect(a).not.toBe(b);
    });

    it("should throw when resolving scoped async token from root", async () => {
      const token = new InjectionToken<unknown>("scopedRoot");
      container.register({
        provide: token,
        useFactory: async () => ({}),
        lifetime: Lifetime.SCOPED,
      });

      await expect(container.resolveAsync(token)).rejects.toThrow(
        "Cannot resolve scoped token",
      );
    });

    it("should propagate rejection from async factory", async () => {
      const token = new InjectionToken<string>("failing");
      const boom = new Error("factory failed");
      container.register({
        provide: token,
        useFactory: () => Promise.reject(boom),
      });

      await expect(container.resolveAsync(token)).rejects.toThrow(
        "factory failed",
      );
    });

    it("should retry async factory after a previous rejection", async () => {
      const token = new InjectionToken<string>("retryable");
      let calls = 0;
      container.register({
        provide: token,
        useFactory: () => {
          calls++;
          if (calls === 1) return Promise.reject(new Error("first attempt"));
          return Promise.resolve("success");
        },
      });

      await expect(container.resolveAsync(token)).rejects.toThrow(
        "first attempt",
      );
      expect(await container.resolveAsync(token)).toBe("success");
    });

    it("should still throw in sync resolve() when factory returns a Promise, with hint", () => {
      const token = new InjectionToken("asyncBadV2");
      container.register({
        provide: token,
        useFactory: (() => Promise.resolve("value")) as any,
      });

      expect(() => container.resolve(token)).toThrow(
        "Use resolveAsync() instead",
      );
    });

    it("should throw in sync resolve() when an async factory is currently in-flight", async () => {
      const token = new InjectionToken<string>("inflight");
      let release!: () => void;
      const gate = new Promise<void>((res) => (release = res));

      container.register({
        provide: token,
        useFactory: async () => {
          await gate; // block until we call release()
          return "done";
        },
      });

      // Start the async creation but do not await it yet.
      const inFlight = container.resolveAsync(token);

      // Synchronous resolve() while the async factory is still in-flight should throw.
      expect(() => container.resolve(token)).toThrow(
        "Use resolveAsync() instead",
      );

      // Unblock the factory and await completion to avoid dangling promises.
      release();
      await inFlight;
    });
  });
});
