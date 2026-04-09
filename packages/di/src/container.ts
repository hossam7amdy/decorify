import type {
  Token,
  Provider,
  Constructor,
  ClassProvider,
  FactoryProvider,
} from "./types.js";
import { DI_INJECTABLE, DI_LIFETIME } from "./metadata.js";
import { injectionContext } from "./context.js";
import type { Resolver } from "./context.js";
import {
  hasStrategy,
  isClassProvider,
  isConstructorProvider,
  isExistingProvider,
  isFactoryProvider,
  isOptionalFactoryDependency,
  isValueProvider,
  tokenName,
} from "./utils.js";
import {
  AsyncFactoryError,
  CaptiveDependencyError,
  CircularDependencyError,
  ContainerDisposedError,
  DISuppressedError,
  DuplicateTokenError,
  MissingStrategyError,
  NoProviderError,
  ScopedResolutionError,
} from "./errors.js";
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
  private disposed = false;
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

    if (!hasStrategy(provider)) {
      throw new MissingStrategyError(token);
    }

    if (this.registry.has(token) && !opts?.override) {
      throw new DuplicateTokenError(token);
    }

    const lifetime = this.resolveLifetime(provider);
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
    if (this.disposed) {
      throw new ContainerDisposedError(token);
    }

    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    if (this.pendingAsync.has(token)) {
      throw new AsyncFactoryError(token);
    }

    let entry = this.lookup(token);

    if (!entry) {
      this.tryAutoRegister(token);
      entry = this.registry.get(token);
    }

    if (!entry) {
      throw new NoProviderError(token);
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
      throw new ScopedResolutionError(token);
    }

    const ctx = injectionContext.getStore()!;

    if (ctx.resolutionStack.includes(token)) {
      const cycle = [
        ...ctx.resolutionStack.slice(ctx.resolutionStack.indexOf(token)),
        token,
      ]
        .map((t) => tokenName(t))
        .join(" → ");
      throw new CircularDependencyError(cycle);
    }

    if (isExistingProvider(entry.provider)) {
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
        throw new CaptiveDependencyError(
          parent.lifetime,
          parent.token,
          lifetime,
          token,
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
    if (this.disposed) return;
    this.disposed = true;

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
          ? new DISuppressedError(
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

  private resolveLifetime(provider: Provider): Lifetime {
    let lifetime: Lifetime | undefined;
    if (isConstructorProvider(provider)) {
      lifetime = (provider as any)[Symbol.metadata]?.[DI_LIFETIME];
    }
    if (isClassProvider(provider)) {
      const Class = provider.useClass;
      lifetime =
        provider.lifetime ?? (Class as any)[Symbol.metadata]?.[DI_LIFETIME];
    }
    if (isFactoryProvider(provider)) {
      lifetime = provider.lifetime;
    }
    return lifetime ?? Lifetime.SINGLETON;
  }

  private tryAutoRegister<T>(token: Token<T>): void {
    if (typeof token !== "function") return;
    const meta = (token as any)[Symbol.metadata];
    if (!meta?.[DI_INJECTABLE]) return;
    this.register(token as Constructor<T>);
  }

  private createInstance<T>(entry: ResolvedEntry<T>): T {
    const p = entry.provider;
    if (isValueProvider(p)) return p.useValue;
    if (isFactoryProvider(p)) return this.buildFactoryInstance(p);
    return new (p as ClassProvider<T>).useClass();
  }

  private buildFactoryInstance<T>(provider: FactoryProvider<T>): T {
    const deps = provider.inject ?? [];
    const args: unknown[] = [];
    for (const dep of deps) {
      if (isOptionalFactoryDependency(dep)) {
        if (dep.optional && !this.has(dep.token)) {
          args.push(undefined);
        } else {
          args.push(this.resolveInContext(dep.token));
        }
      } else {
        args.push(this.resolveInContext(dep as Token));
      }
    }
    const result = provider.useFactory(...args);
    if (result instanceof Promise) {
      throw new AsyncFactoryError(provider.provide);
    }
    return result as T;
  }

  private async resolveInContextAsync<T>(token: Token<T>): Promise<T> {
    if (this.disposed) {
      throw new ContainerDisposedError(token);
    }

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
      throw new NoProviderError(token);
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
      throw new ScopedResolutionError(token);
    }

    const ctx = injectionContext.getStore()!;

    if (ctx.resolutionStack.includes(token)) {
      const cycle = [
        ...ctx.resolutionStack.slice(ctx.resolutionStack.indexOf(token)),
        token,
      ]
        .map((t) => tokenName(t))
        .join(" → ");
      throw new CircularDependencyError(cycle);
    }

    if (isExistingProvider(entry.provider)) {
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
        throw new CaptiveDependencyError(
          parent.lifetime,
          parent.token,
          lifetime,
          token,
        );
      }
    }

    ctx.resolutionStack.push(token);
    ltStack.push({ token, lifetime });
    try {
      if (lifetime !== Lifetime.TRANSIENT) {
        const promise = (async () => {
          try {
            const instance = await this.createInstanceAsync(entry);
            this.instances.set(token, instance);
            return instance;
          } finally {
            this.pendingAsync.delete(token);
          }
        })();
        this.pendingAsync.set(token, promise);
        return (await promise) as T;
      }
      return (await this.createInstanceAsync(entry)) as T;
    } finally {
      ctx.resolutionStack.pop();
      ltStack.pop();
    }
  }

  private async createInstanceAsync<T>(entry: ResolvedEntry<T>): Promise<T> {
    const p = entry.provider;
    if (isValueProvider(p)) {
      return p.useValue;
    }
    if (isFactoryProvider(p)) {
      return this.buildFactoryInstanceAsync<T>(p);
    }
    return new (p as ClassProvider<T>).useClass();
  }

  private async buildFactoryInstanceAsync<T>(
    p: FactoryProvider<T>,
  ): Promise<T> {
    const deps = p.inject ?? [];
    const args: unknown[] = [];

    for (const dep of deps) {
      if (isOptionalFactoryDependency(dep)) {
        if (dep.optional && !this.has(dep.token)) {
          args.push(undefined);
        } else {
          args.push(await this.resolveInContextAsync(dep.token));
        }
      } else {
        args.push(await this.resolveInContextAsync(dep as Token));
      }
    }

    return await p.useFactory(...args);
  }
}
