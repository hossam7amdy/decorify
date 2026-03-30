import type {
  AsyncInitializable,
  Constructor,
  Lifetime,
  Provider,
  Token,
} from "./types.js";

function hasAsyncInit(obj: unknown): obj is AsyncInitializable {
  return typeof (obj as any)?.init === "function";
}

const LIFETIME_RANK: Record<Lifetime, number> = {
  singleton: 0,
  scoped: 1,
  transient: 2,
};

export default class Container {
  private instances = new Map<Token, any>();
  private registry = new Map<Token, Provider>();
  private injectionContext = false;
  private resolutionStack: Token[] = [];
  private static lifetimeStack: { token: Token; lifetime: Lifetime }[] = [];
  private initializedTokens = new Set<Token>();
  private parent: Container | null = null;
  private isScoped = false;

  private tokenName(token: Token): string {
    return typeof token === "function" ? token.name : String(token);
  }

  private guardDuplicate(token: Token, override?: boolean): void {
    if (this.registry.has(token) && !override) {
      throw new Error(
        `[DI] Token "${this.tokenName(token)}" is already registered. Pass { override: true } to replace it.`,
      );
    }
  }

  private instantiate<T>(provider: Provider<T>): T {
    switch (provider.kind) {
      case "class":
        return new provider.target() as T;
      case "factory":
        return provider.factory();
      case "value":
        return provider.value;
    }
  }

  private getLifetime(provider: Provider): Lifetime {
    return provider.kind === "value" ? "singleton" : provider.lifetime;
  }

  register<T>(
    targetOrToken: Token<T>,
    target?: Constructor<T> | { override?: boolean; lifetime?: Lifetime },
    opts?: { override?: boolean; lifetime?: Lifetime },
  ): void {
    if (typeof target === "object") {
      opts = target;
      target = targetOrToken as Constructor<T>;
    }
    if (!target && typeof targetOrToken !== "function") {
      throw new Error("[DI] Invalid token");
    }
    this.guardDuplicate(targetOrToken, opts?.override);
    this.registry.set(targetOrToken, {
      kind: "class",
      target: target ?? (targetOrToken as Constructor<T>),
      lifetime: opts?.lifetime ?? "singleton",
    });
  }

  registerValue<T>(
    token: Token<T>,
    value: T,
    opts?: { override?: boolean },
  ): void {
    this.guardDuplicate(token, opts?.override);
    this.registry.set(token, { kind: "value", value });
    this.instances.set(token, value);
  }

  registerFactory<T>(
    token: Token<T>,
    factory: () => T,
    opts?: { override?: boolean; lifetime?: Lifetime },
  ): void {
    this.guardDuplicate(token, opts?.override);
    this.registry.set(token, {
      kind: "factory",
      factory,
      lifetime: opts?.lifetime ?? "singleton",
    });
  }

  resolve<T>(token: Token<T>): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    const provider = this.registry.get(token);
    if (!provider) {
      throw new Error(
        `[DI] No provider registered for ${this.tokenName(token)}. Did you forget @Injectable()?`,
      );
    }

    const lifetime = this.getLifetime(provider);

    // Singletons in child containers delegate to the parent
    if (lifetime === "singleton" && this.parent) {
      return this.parent.resolve(token);
    }

    if (lifetime === "scoped" && !this.isScoped) {
      throw new Error(
        `[DI] Cannot resolve scoped token "${this.tokenName(token)}" from root container. Use createScope().`,
      );
    }

    if (this.resolutionStack.includes(token)) {
      const cycle = [
        ...this.resolutionStack.slice(this.resolutionStack.indexOf(token)),
        token,
      ]
        .map((t) => this.tokenName(t))
        .join(" → ");
      throw new Error(`[DI] Circular dependency detected: ${cycle}`);
    }

    // Captive dependency check: a longer-lived service must not capture a shorter-lived one
    const stack = Container.lifetimeStack;
    if (stack.length > 0) {
      const parent = stack[stack.length - 1]!;
      if (LIFETIME_RANK[parent.lifetime] < LIFETIME_RANK[lifetime]) {
        throw new Error(
          `[DI] Captive dependency detected: ${parent.lifetime} "${this.tokenName(parent.token)}" depends on ${lifetime} "${this.tokenName(token)}". A longer-lived service must not capture a shorter-lived one.`,
        );
      }
    }

    this.resolutionStack.push(token);
    stack.push({ token, lifetime });
    const prev = this.injectionContext;
    this.injectionContext = true;
    try {
      const instance = this.instantiate(provider);
      if (lifetime !== "transient") {
        this.instances.set(token, instance);
      }
      return instance as T;
    } finally {
      this.resolutionStack.pop();
      stack.pop();
      this.injectionContext = prev;
    }
  }

  async resolveAsync<T>(token: Token<T>): Promise<T> {
    const provider = this.registry.get(token);
    const lifetime = provider ? this.getLifetime(provider) : "singleton";

    // Delegate singleton to parent in scoped containers
    if (lifetime === "singleton" && this.parent) {
      return this.parent.resolveAsync(token);
    }

    const instance = this.resolve(token);

    if (
      hasAsyncInit(instance) &&
      (lifetime === "transient" || !this.initializedTokens.has(token))
    ) {
      this.initializedTokens.add(token);
      await instance.init();
    }

    return instance;
  }

  createScope(): Container {
    const child = new Container();
    child.registry = this.registry;
    child.parent = this;
    child.isScoped = true;
    return child;
  }

  validate(tokens: Token[]): void {
    const missing = tokens.filter((t) => !this.registry.has(t));
    if (missing.length > 0) {
      const names = missing.map((t) => this.tokenName(t)).join(", ");
      throw new Error(`[DI] Missing registrations: ${names}`);
    }
  }

  get isInInjectionContext(): boolean {
    return this.injectionContext;
  }

  clear(): void {
    this.instances.clear();
    if (!this.isScoped) {
      this.registry.clear();
    }
    this.resolutionStack = [];
    this.initializedTokens.clear();
  }
}

export const container = new Container();
