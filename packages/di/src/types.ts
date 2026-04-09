import type { Lifetime } from "./lifetime.js";
import type { InjectionToken } from "./injection-token.js";

export type Constructor<T = any> = new (...args: any[]) => T;

export type Token<T = any> = Constructor<T> | InjectionToken<T>;

export type OptionalFactoryDependency<T = any> = {
  token: Token<T>;
  optional: boolean;
};

export type Provider<T = any> =
  | Constructor<T>
  | ClassProvider<T>
  | ValueProvider<T>
  | FactoryProvider<T>
  | ExistingProvider<T>;

export interface ClassProvider<T = any> {
  provide: Token;
  useClass: Constructor<T>;
  lifetime?: Lifetime;
}

export interface ValueProvider<T = any> {
  provide: Token;
  useValue: T;
}

export interface FactoryProvider<T = any> {
  provide: Token;
  useFactory: (...args: any[]) => T;
  inject?: Array<Token | OptionalFactoryDependency>;
  lifetime?: Lifetime;
}

export interface ExistingProvider<T = any> {
  provide: Token;
  useExisting: Token<T>;
}
