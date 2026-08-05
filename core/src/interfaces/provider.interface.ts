import type {
  ClassProvider,
  Constructor,
  ExistingProvider,
  Lifetime,
  Token,
  ValueProvider,
} from "injectus";

/**
 * Provide a value by calling a function.
 *
 * Replaces injectus's own `FactoryProvider`, whose factory takes no arguments
 * and calls `inject()` internally. Declaring dependencies in `inject` instead
 * keeps them readable by the graph checker.
 *
 * The factory must be synchronous: injectus resolves synchronously, and a
 * returned promise fails boot with `DECORIFY_E_ASYNC_FACTORY`. Async setup
 * belongs in discovery — await the value in a module's configuring method and
 * hand back a `DynamicModule` that provides it, so everything the injector
 * holds is already settled.
 *
 * @example
 * ```ts
 * class DatabaseModule {
 *   static async forRoot(url: string): Promise<DynamicModule> {
 *     const db = await Database.connect(url);
 *     return {
 *       module: DatabaseModule,
 *       providers: [{ provide: Database, useValue: db }],
 *       exports: [Database],
 *     };
 *   }
 * }
 * ```
 *
 * @example
 * ```ts
 * {
 *   provide: Database,
 *   inject: [CONFIG],
 *   useFactory: (config: AppConfig) => new Database(config.url),
 * }
 * ```
 */
export interface FactoryProvider<T = unknown> {
  provide: Token<T>;
  /** Receives one argument per entry in `inject`, in the same order. */
  useFactory: (...args: any[]) => T;
  /** @default Lifetime.Singleton */
  lifetime?: Lifetime;
  /** Tokens resolved and passed to `useFactory`. */
  inject?: Token[];
}

/**
 * Every shape a provider registration can take.
 *
 * A bare class is shorthand for `{ provide: C, useClass: C }`, with its lifetime
 * read from `@Injectable`.
 */
export type Provider<T = unknown> =
  | Constructor<T>
  | ValueProvider<T>
  | ClassProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;
