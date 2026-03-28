import type { HttpContext } from "./context.js";

export type Constructor<T = any> = new (...args: any[]) => T;

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
