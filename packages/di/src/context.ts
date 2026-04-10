import { AsyncLocalStorage } from "node:async_hooks";
import type { Token } from "./types.js";
import type { Lifetime } from "./lifetime.js";
import { InjectionContextError } from "./errors.js";

export interface Resolver {
  resolveInContext<T>(token: Token<T>): T;
  resolveInContextAsync<T>(token: Token<T>): Promise<T>;
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
  if (!ctx) throw new InjectionContextError("inject");
  return ctx.container.resolveInContext(token);
}

/**
 * Asynchronously resolve a dependency from the current injection context.
 * Must be awaited. Can only be called inside an async factory function
 * that is being resolved by the DI container.
 * Works for async singletons (without pre-priming) and transient async providers.
 *
 * @example
 * container.register({
 *   provide: USER_REPO,
 *   useFactory: async () => new UserRepository(await injectAsync(DATABASE)),
 * });
 */
export async function injectAsync<T>(token: Token<T>): Promise<T> {
  const ctx = injectionContext.getStore();
  if (!ctx) throw new InjectionContextError("injectAsync");
  return ctx.container.resolveInContextAsync(token);
}
