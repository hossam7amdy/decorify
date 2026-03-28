import type { Constructor, Token } from "../types.js";

class Container {
  private instances = new Map<Token, any>();
  private registry = new Map<Token, Constructor>();
  private injectionContext = false;

  register<T>(token: Token<T>, target?: Constructor<T>): void {
    if (!target && typeof token !== "function") {
      throw new Error("[DI] Invalid token");
    }
    this.registry.set(token, target ?? (token as Constructor<T>));
  }

  resolve<T>(token: Token<T>): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    const Target = this.registry.get(token);
    if (!Target) {
      throw new Error(
        `[DI] No provider registered for ${typeof token === "function" ? token.name : String(token)}. Did you forget @Injectable()?`,
      );
    }

    // Enter injection context so inject() calls work during construction
    const prev = this.injectionContext;
    this.injectionContext = true;
    try {
      const instance = new Target();
      this.instances.set(token, instance);
      return instance as T;
    } finally {
      this.injectionContext = prev;
    }
  }

  get isInInjectionContext(): boolean {
    return this.injectionContext;
  }

  clear(): void {
    this.instances.clear();
    this.registry.clear();
  }
}

export const container = new Container();
