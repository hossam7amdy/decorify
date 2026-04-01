import { AsyncLocalStorage } from "node:async_hooks";
import type { Token } from "./types.js";
import type { Lifetime } from "./lifetime.js";

export interface Resolver {
  resolveSync<T>(token: Token<T>): T;
}

export interface InjectionContext {
  container: Resolver;
  /** Tracks the resolution chain to detect circular deps */
  resolutionStack: Token[];
  /** Tracks lifetime chain to detect captive dependencies */
  lifetimeStack: { token: Token; lifetime: Lifetime }[];
}

export const injectionContext = new AsyncLocalStorage<InjectionContext>();

/**
 * Resolve a dependency from the current injection context.
 * Can be called inside class constructors, factory functions, or any code
 * running within a container.resolve() call.
 *
 * @example
 * class UserService {
 *   private db = inject(DatabaseService);
 *   private config = inject(APP_CONFIG);
 * }
 */
export function inject<T>(token: Token<T>): T {
  const ctx = injectionContext.getStore();
  if (!ctx) {
    throw new Error(
      `inject() called outside of an injection context. ` +
        `It can only be used inside a class constructor or factory function ` +
        `that is being resolved by the DI container.`,
    );
  }
  return ctx.container.resolveSync(token);
}
