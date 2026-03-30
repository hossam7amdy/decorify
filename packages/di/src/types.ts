export type Constructor<T = any> = new (...args: any[]) => T;

export type AbstractConstructor<T = any> = abstract new (...args: any[]) => T;

export type Token<T = any> =
  | AbstractConstructor<T>
  | Constructor<T>
  | symbol
  | string;

export type Lifetime = "singleton" | "transient" | "scoped";

export type Provider<T = any> =
  | { kind: "class"; target: Constructor<T>; lifetime: Lifetime }
  | { kind: "factory"; factory: () => T; lifetime: Lifetime }
  | { kind: "value"; value: T };

export interface AsyncInitializable {
  init(): Promise<void>;
}
