import type {
  AsyncInitializable,
  ClassProvider,
  Constructor,
  NormalizedProvider,
  Provider,
  Scope,
  Token,
} from "./types.js";
import { Scope as ScopeValue } from "./types.js";
import { DI_INJECTABLE, DI_SCOPE } from "./metadata.js";
import { injectionContext } from "./context.js";
import type { Resolver } from "./context.js";
import { tokenName } from "./utils.js";

function hasAsyncInit(obj: unknown): obj is AsyncInitializable {
  return typeof (obj as any)?.init === "function";
}

const SCOPE_RANK: Record<Scope, number> = {
  singleton: 0,
  scoped: 1,
  transient: 2,
};

interface ResolvedEntry<T = any> {
  provider: NormalizedProvider<T>;
  scope: Scope;
}

export class Container implements Resolver {
  private registry = new Map<Token, ResolvedEntry>();
  private instances = new Map<Token, any>();
  private initializedTokens = new Set<Token>();
  private parent: Container | null = null;
  private isScoped = false;

  register<T>(provider: Provider<T>, opts?: { override?: boolean }): void {
    const normalized = this.normalizeProvider(provider);
    const token = normalized.provide;

    if (this.registry.has(token) && !opts?.override) {
      throw new Error(
        `[DI] Token "${tokenName(token)}" is already registered. Pass { override: true } to replace it.`,
      );
    }

    const scope =
      normalized.scope ?? this.inferScope(normalized) ?? ScopeValue.Singleton;
    this.registry.set(token, { provider: normalized, scope });
  }

  registerMany(providers: Provider[]): void {
    for (const p of providers) this.register(p);
  }

  resolve<T>(token: Token<T>): T {
    const existingCtx = injectionContext.getStore();
    if (existingCtx) {
      return this.resolveSync(token);
    }
    return injectionContext.run(
      { container: this, resolutionStack: [], lifetimeStack: [] },
      () => this.resolveSync(token),
    );
  }

  /** @internal — used by inject() and internally for recursive resolution */
  resolveSync<T>(token: Token<T>): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    let entry = this.lookup(token);

    if (!entry) {
      this.tryAutoRegister(token);
      entry = this.registry.get(token);
    }

    if (!entry) {
      throw new Error(
        `[DI] No provider registered for ${tokenName(token)}. Did you forget @Injectable() or container.register()?`,
      );
    }

    const scope = entry.scope;

    if (scope === ScopeValue.Singleton && this.parent) {
      return this.parent.resolveSync(token);
    }

    if (scope === ScopeValue.Scoped && !this.isScoped) {
      throw new Error(
        `[DI] Cannot resolve scoped token "${tokenName(token)}" from root container. Use createScope().`,
      );
    }

    const ctx = injectionContext.getStore()!;

    if (ctx.resolutionStack.includes(token)) {
      const cycle = [
        ...ctx.resolutionStack.slice(ctx.resolutionStack.indexOf(token)),
        token,
      ]
        .map((t) => tokenName(t))
        .join(" → ");
      throw new Error(`[DI] Circular dependency detected: ${cycle}`);
    }

    if ("useExisting" in entry.provider) {
      ctx.resolutionStack.push(token);
      try {
        return this.resolveSync(entry.provider.useExisting);
      } finally {
        ctx.resolutionStack.pop();
      }
    }

    const ltStack = ctx.lifetimeStack;
    if (ltStack.length > 0) {
      const parent = ltStack[ltStack.length - 1]!;
      if (SCOPE_RANK[parent.scope] < SCOPE_RANK[scope]) {
        throw new Error(
          `[DI] Captive dependency detected: ${parent.scope} "${tokenName(parent.token)}" depends on ${scope} "${tokenName(token)}". A longer-lived service must not capture a shorter-lived one.`,
        );
      }
    }

    ctx.resolutionStack.push(token);
    ltStack.push({ token, scope });
    try {
      const instance = this.createInstance(entry);
      if (scope !== ScopeValue.Transient) {
        this.instances.set(token, instance);
      }
      return instance as T;
    } finally {
      ctx.resolutionStack.pop();
      ltStack.pop();
    }
  }

  async resolveAsync<T>(token: Token<T>): Promise<T> {
    if (!this.lookup(token)) {
      this.tryAutoRegister(token);
    }
    const entry = this.lookup(token);

    if (entry && entry.scope === ScopeValue.Singleton && this.parent) {
      return this.parent.resolveAsync(token);
    }

    // For factory providers, use async path to support Promise-returning factories
    let instance: T;
    if (entry && "useFactory" in entry.provider) {
      instance = await this.resolveAsyncFactory(token, entry);
    } else {
      instance = this.resolve(token);
    }

    const scope = entry?.scope ?? ScopeValue.Singleton;

    if (
      hasAsyncInit(instance) &&
      (scope === ScopeValue.Transient || !this.initializedTokens.has(token))
    ) {
      this.initializedTokens.add(token);
      await instance.init();
    }

    return instance;
  }

  /** Resolve a factory provider, awaiting the result if it returns a Promise */
  private async resolveAsyncFactory<T>(
    token: Token<T>,
    entry: ResolvedEntry<T>,
  ): Promise<T> {
    // Return cached instance
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    const ctx = injectionContext.getStore();
    const run = <R>(fn: () => R): R => {
      if (ctx) return fn();
      return injectionContext.run(
        { container: this, resolutionStack: [], lifetimeStack: [] },
        fn,
      );
    };

    return run(async () => {
      // Re-check cache after entering context (may have been resolved during await)
      if (this.instances.has(token)) {
        return this.instances.get(token);
      }
      const instance = await this.createInstanceAsync(entry);
      if (entry.scope !== ScopeValue.Transient) {
        this.instances.set(token, instance);
      }
      return instance;
    });
  }

  createScope(): Container {
    const child = new Container();
    child.parent = this;
    child.isScoped = true;
    return child;
  }

  has(token: Token): boolean {
    return this.registry.has(token) || (this.parent?.has(token) ?? false);
  }

  validate(tokens: Token[]): void {
    const missing = tokens.filter((t) => !this.has(t));
    if (missing.length > 0) {
      const names = missing.map((t) => tokenName(t)).join(", ");
      throw new Error(`[DI] Missing registrations: ${names}`);
    }
  }

  get isInInjectionContext(): boolean {
    return injectionContext.getStore() !== undefined;
  }

  clear(): void {
    this.instances.clear();
    this.registry.clear();
    this.initializedTokens.clear();
  }

  private lookup(token: Token): ResolvedEntry | undefined {
    return this.registry.get(token) ?? this.parent?.lookup(token);
  }

  private normalizeProvider<T>(
    provider: Provider<T>,
  ): NormalizedProvider<T> & { provide: Token<T> } {
    if (typeof provider === "function") {
      return {
        provide: provider as Token<T>,
        useClass: provider,
      } as ClassProvider<T> & { provide: Token<T> };
    }
    return provider as NormalizedProvider<T> & { provide: Token<T> };
  }

  private inferScope(provider: NormalizedProvider): Scope | undefined {
    const ctor = "useClass" in provider ? provider.useClass : null;
    if (ctor && (ctor as any)[Symbol.metadata]?.[DI_SCOPE]) {
      return (ctor as any)[Symbol.metadata][DI_SCOPE] as Scope;
    }
    return undefined;
  }

  private tryAutoRegister<T>(token: Token<T>): void {
    if (typeof token !== "function") return;
    const meta = (token as any)[Symbol.metadata];
    if (!meta?.[DI_INJECTABLE]) return;
    this.register(token as Constructor<T>);
  }

  private createInstance<T>(entry: ResolvedEntry<T>): T {
    const p = entry.provider;
    if ("useValue" in p) return p.useValue;
    if ("useFactory" in p) {
      const result = p.useFactory();
      if (result instanceof Promise) {
        throw new Error(
          `[DI] Factory for "${tokenName((p as any).provide)}" returned a Promise. ` +
            `Use container.resolveAsync() for async factories.`,
        );
      }
      return result as T;
    }
    const ctor: Constructor<T> = (p as ClassProvider<T>).useClass;
    return new ctor();
  }

  /** @internal — async instantiation for factories that return promises */
  private async createInstanceAsync<T>(entry: ResolvedEntry<T>): Promise<T> {
    const p = entry.provider;
    if ("useFactory" in p) {
      return await p.useFactory();
    }
    return this.createInstance(entry);
  }
}
