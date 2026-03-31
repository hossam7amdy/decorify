import type {
  ClassProvider,
  Constructor,
  NormalizedProvider,
  Provider,
  Token,
} from "./types.js";
import { Scope } from "./types.js";
import { DI_INJECTABLE, DI_SCOPE } from "./metadata.js";
import { injectionContext } from "./context.js";
import type { Resolver } from "./context.js";
import { tokenName } from "./utils.js";

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
  private parent: Container | null = null;
  private isScoped = false;

  register<T>(provider: Provider<T>, opts?: { override?: boolean }): void {
    const normalized = this.normalizeProvider(provider);
    const token = normalized.provide;

    if (typeof provider !== "function") {
      const hasStrategy =
        "useClass" in normalized ||
        "useValue" in normalized ||
        "useFactory" in normalized ||
        "useExisting" in normalized;
      if (!hasStrategy) {
        throw new Error(
          `[DI] Provider for "${tokenName(token)}" is missing a strategy. ` +
            `Specify one of: useClass, useValue, useFactory, or useExisting.`,
        );
      }
    }

    if (this.registry.has(token) && !opts?.override) {
      throw new Error(
        `[DI] Token "${tokenName(token)}" is already registered. Pass { override: true } to replace it.`,
      );
    }

    const scope =
      normalized.scope ?? this.inferScope(normalized) ?? Scope.Singleton;
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

    if (scope === Scope.Singleton && this.parent) {
      return this.parent.resolveSync(token);
    }

    if (scope === Scope.Scoped && !this.isScoped) {
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
      if (scope !== Scope.Transient) {
        this.instances.set(token, instance);
      }
      return instance as T;
    } finally {
      ctx.resolutionStack.pop();
      ltStack.pop();
    }
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
            `Async factories are not supported.`,
        );
      }
      return result as T;
    }
    const ctor: Constructor<T> = (p as ClassProvider<T>).useClass;
    return new ctor();
  }
}
