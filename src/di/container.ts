import type { Constructor } from "../types.js";

class Container {
  private instances = new Map<Constructor, any>();
  private registry = new Map<Constructor, Constructor>();
  private injectionContext = false;

  register<T>(token: Constructor<T>, target?: Constructor<T>): void {
    this.registry.set(token, target ?? token);
  }

  resolve<T>(token: Constructor<T>): T {
    if (this.instances.has(token)) {
      return this.instances.get(token);
    }

    const Target = this.registry.get(token);
    if (!Target) {
      throw new Error(
        `[DI] No provider registered for ${token.name}. Did you forget @Injectable()?`,
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
