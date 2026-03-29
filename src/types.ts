import type { HttpContext } from "./context.js";

export type Constructor<T = any> = new (...args: any[]) => T;

export type AbstractConstructor<T = any> = abstract new (...args: any[]) => T;

export type RouteHandler = (ctx: HttpContext) => unknown | Promise<unknown>;

export type MiddlewareHandler = (
  ctx: HttpContext,
  next: () => Promise<void>,
) => unknown | Promise<unknown>;

export type ErrorHandler = (
  error: Error,
  ctx: HttpContext,
) => unknown | Promise<unknown>;

export interface Guard {
  canActivate(ctx: HttpContext): boolean | Promise<boolean>;
}

export interface ExceptionFilter {
  catch(error: Error, ctx: HttpContext): void | Promise<void>;
}

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
