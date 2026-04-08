import type {
  ClassProvider,
  Constructor,
  FactoryProvider,
  OptionalFactoryDependency,
  Provider,
  Token,
} from "./types.js";
import { DI_INJECTABLE, DI_LIFETIME } from "./metadata.js";
import { injectionContext } from "./context.js";
import type { Resolver } from "./context.js";
import { tokenName } from "./utils.js";
import { Lifetime } from "./lifetime.js";

const SCOPE_RANK: Record<Lifetime, number> = {
  singleton: 0,
  scoped: 1,
  transient: 2,
};

interface ResolvedEntry<T = any> {
  provider: Provider<T>;
  lifetime: Lifetime;
}

export class Container implements Resolver {
  private registry = new Map<Token, ResolvedEntry>();
  private instances = new Map<Token, any>();
  private pendingAsync = new Map<Token, Promise<any>>();

  constructor(
    private parent?: Container,
    private isScoped = false,
  ) {}

  register<T>(provider: Provider<T>, opts?: { override?: boolean }): void {
    if (typeof provider === "function") {
      provider = {
        provide: provider,
        useClass: provider,
      };
    }

    const token = provider.provide;

    const hasStrategy =
      "useClass" in provider ||
      "useValue" in provider ||
      "useFactory" in provider ||
      "useExisting" in provider;
    if (!hasStrategy) {
      throw new Error(
        `[DI] Provider for "${tokenName(token)}" is missing a strategy. ` +
          `Specify one of: useClass, useValue, useFactory, or useExisting.`,
      );
    }

    if (this.registry.has(token) && !opts?.override) {
      throw new Error(
        `[DI] Token "${tokenName(token)}" is already registered. Pass { override: true } to replace it.`,
      );
    }

    const lifetime = this.inferLifetime(provider) ?? Lifetime.SINGLETON;
    this.registry.set(token, { provider: provider, lifetime });
  }

  resolve<T>(token: Token<T>): T {
    const existingCtx = injectionContext.getStore();
    if (existingCtx) {
      return this.resolveInContext(token);
    }
    return injectionContext.run(
      { container: this, resolutionStack: [], lifetimeStack: [] },
      () => this.resolveInContext(token),
    );
  }

  async resolveAsync<T>(token: Token<T>): Promise<T> {
    const existingCtx = injectionContext.getStore();
    if (existingCtx) {
      return this.resolveInContextAsync(token);
    }
    return injectionContext.run(
      { container: this, resolutionStack: [], lifetimeStack: [] },
      () => this.resolveInContextAsync(token),
    );
  }

  /** @internal — used by inject() and internally for recursive resolution */
  resolveInContext<T>(token: Token<T>): T {
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

    const lifetime = entry.lifetime;

    if (lifetime === Lifetime.SINGLETON && this.parent) {
      const ctx = injectionContext.getStore()!;
      const prev = ctx.container;
      ctx.container = this.parent;
      try {
        return this.parent.resolveInContext(token);
      } finally {
        ctx.container = prev;
      }
    }

    if (lifetime === Lifetime.SCOPED && !this.isScoped) {
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
        return this.resolveInContext(entry.provider.useExisting);
      } finally {
        ctx.resolutionStack.pop();
      }
    }

    const ltStack = ctx.lifetimeStack;
    if (ltStack.length > 0) {
      const parent = ltStack[ltStack.length - 1]!;
      if (SCOPE_RANK[parent.lifetime] < SCOPE_RANK[lifetime]) {
        throw new Error(
          `[DI] Captive dependency detected: ${parent.lifetime} "${tokenName(parent.token)}" depends on ${lifetime} "${tokenName(token)}". A longer-lived service must not capture a shorter-lived one.`,
        );
      }
    }

    ctx.resolutionStack.push(token);
    ltStack.push({ token, lifetime });
    try {
      const instance = this.createInstance(entry);
      if (lifetime !== Lifetime.TRANSIENT) {
        this.instances.set(token, instance);
      }
      return instance as T;
    } finally {
      ctx.resolutionStack.pop();
      ltStack.pop();
    }
  }

  /** @internal — async counterpart to resolveInContext */
  private async resolveInContextAsync<T>(token: Token<T>): Promise<T> {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    if (this.pendingAsync.has(token)) {
      return this.pendingAsync.get(token);
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

    const lifetime = entry.lifetime;

    if (lifetime === Lifetime.SINGLETON && this.parent) {
      const ctx = injectionContext.getStore()!;
      const prev = ctx.container;
      ctx.container = this.parent;
      try {
        return await this.parent.resolveInContextAsync(token);
      } finally {
        ctx.container = prev;
      }
    }

    if (lifetime === Lifetime.SCOPED && !this.isScoped) {
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
        return await this.resolveInContextAsync(entry.provider.useExisting);
      } finally {
        ctx.resolutionStack.pop();
      }
    }

    const ltStack = ctx.lifetimeStack;
    if (ltStack.length > 0) {
      const parent = ltStack[ltStack.length - 1]!;
      if (SCOPE_RANK[parent.lifetime] < SCOPE_RANK[lifetime]) {
        throw new Error(
          `[DI] Captive dependency detected: ${parent.lifetime} "${tokenName(parent.token)}" depends on ${lifetime} "${tokenName(token)}". A longer-lived service must not capture a shorter-lived one.`,
        );
      }
    }

    ctx.resolutionStack.push(token);
    ltStack.push({ token, lifetime });
    try {
      if (lifetime !== Lifetime.TRANSIENT) {
        const promise = this.createInstanceAsync(entry)
          .then((instance) => {
            this.instances.set(token, instance);
            return instance;
          })
          .finally(() => {
            this.pendingAsync.delete(token);
          });
        this.pendingAsync.set(token, promise);
        return (await promise) as T;
      }
      return (await this.createInstanceAsync(entry)) as T;
    } finally {
      ctx.resolutionStack.pop();
      ltStack.pop();
    }
  }

  createScope(): Container {
    return new Container(this, true);
  }

  has(token: Token): boolean {
    return this.registry.has(token) || (this.parent?.has(token) ?? false);
  }

  get isInInjectionContext(): boolean {
    return injectionContext.getStore() !== undefined;
  }

  async dispose(): Promise<void> {
    if (this.pendingAsync.size > 0) {
      await Promise.allSettled(this.pendingAsync.values());
    }

    const instances = [...this.instances.values()].reverse();
    this.clear();

    let error: unknown;
    let hasError = false;

    for (const instance of instances) {
      if (instance == null) continue;
      try {
        if (typeof instance[Symbol.asyncDispose] === "function") {
          await instance[Symbol.asyncDispose]();
        } else if (typeof instance[Symbol.dispose] === "function") {
          instance[Symbol.dispose]();
        }
      } catch (err) {
        error = hasError
          ? new SuppressedError(
              err,
              error,
              "An error was suppressed during disposal.",
            )
          : err;
        hasError = true;
      }
    }

    if (hasError) throw error;
  }

  private clear(): void {
    this.instances.clear();
    this.registry.clear();
    this.pendingAsync.clear();
  }

  private lookup(token: Token): ResolvedEntry | undefined {
    return this.registry.get(token) ?? this.parent?.lookup(token);
  }

  private inferLifetime(provider: Provider): Lifetime | undefined {
    if (typeof provider === "function") {
      return (provider as any)[Symbol.metadata]?.[DI_LIFETIME];
    }
    if ("useClass" in provider) {
      const ctor = provider.useClass ?? {};
      return provider.lifetime ?? (ctor as any)[Symbol.metadata]?.[DI_LIFETIME];
    }
    if ("useFactory" in provider) {
      return provider.lifetime;
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
    if ("useValue" in p) {
      return p.useValue;
    }
    if ("useFactory" in p) {
      return this.buildFactoryInstance<T>(p);
    }
    return new (p as ClassProvider<T>).useClass();
  }

  private buildFactoryInstance<T>(p: FactoryProvider<T>) {
    const deps = (p as FactoryProvider).inject;

    const args: unknown[] = (deps ?? []).map((dep) => {
      if (this.isOptionalFactoryDependency(dep)) {
        const optDep = dep as OptionalFactoryDependency;
        if (optDep.optional && !this.has(optDep.token)) {
          return undefined;
        }
        return this.resolveInContext(optDep.token);
      }
      return this.resolveInContext(dep);
    });

    const result = p.useFactory(...args);

    if (result instanceof Promise) {
      throw new Error(
        `[DI] Factory for "${tokenName((p as any).provide)}" returned a Promise. ` +
          `Async factories are not supported in resolve(). Use resolveAsync() instead.`,
      );
    }

    return result as T;
  }

  private async createInstanceAsync<T>(entry: ResolvedEntry<T>): Promise<T> {
    const p = entry.provider;
    if ("useValue" in p) {
      return p.useValue;
    }
    if ("useFactory" in p) {
      return this.buildFactoryInstanceAsync<T>(p);
    }
    return new (p as ClassProvider<T>).useClass();
  }

  private async buildFactoryInstanceAsync<T>(
    p: FactoryProvider<T>,
  ): Promise<T> {
    const deps = (p as FactoryProvider).inject;
    const args: unknown[] = [];

    for (const dep of deps ?? []) {
      if (this.isOptionalFactoryDependency(dep)) {
        const optDep = dep as OptionalFactoryDependency;
        if (optDep.optional && !this.has(optDep.token)) {
          args.push(undefined);
        } else {
          args.push(await this.resolveInContextAsync(optDep.token));
        }
      } else {
        args.push(await this.resolveInContextAsync(dep as Token));
      }
    }

    return await p.useFactory(...args);
  }

  private isOptionalFactoryDependency(
    dep: Token<any> | OptionalFactoryDependency,
  ) {
    return (
      dep && typeof dep === "object" && "token" in dep && "optional" in dep
    );
  }
}
