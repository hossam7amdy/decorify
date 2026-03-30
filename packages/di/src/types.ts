/** Class constructor type */
export type Constructor<T = any> = new (...args: any[]) => T;

export const Scope = {
  Singleton: "singleton",
  Transient: "transient",
  Scoped: "scoped",
} as const;

export type Scope = (typeof Scope)[keyof typeof Scope];

export interface AsyncInitializable {
  init(): Promise<void>;
}

/** Unique key used to register/resolve a dependency */
export type Token<T = any> = Constructor<T> | InjectionToken<T>;

/**
 * Named/typed token for non-class dependencies (config values, interfaces, etc.)
 *
 * @example
 * const DB_URL = new InjectionToken<string>('DB_URL');
 */
export class InjectionToken<T = any> {
  constructor(readonly description: string) {}

  toString(): string {
    return `InjectionToken(${this.description})`;
  }

  // Brand field so TS treats different tokens as different types
  declare readonly __brand: T;
}

export interface ProviderConfig<T = any> {
  provide: Token<T>;
  scope?: Scope;
}

/** Class provider — container instantiates the class */
export interface ClassProvider<T = any> extends ProviderConfig<T> {
  useClass: Constructor<T>;
}

/** Value provider — container stores the literal value */
export interface ValueProvider<T = any> extends ProviderConfig<T> {
  useValue: T;
}

/** Factory provider — container calls the factory to produce the value */
export interface FactoryProvider<T = any> extends ProviderConfig<T> {
  useFactory: () => T | Promise<T>;
}

/** Existing provider — alias one token to another */
export interface ExistingProvider<T = any> extends ProviderConfig<T> {
  useExisting: Token<T>;
}

/** All structured provider types (excludes bare Constructor) */
export type NormalizedProvider<T = any> =
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;

export type Provider<T = any> = Constructor<T> | NormalizedProvider<T>;
