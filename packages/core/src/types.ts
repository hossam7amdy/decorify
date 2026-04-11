import type { HttpContext } from "./context.js";
import type { Constructor } from "@decorify/di";

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

export type GuardType = Guard | Constructor<Guard>;

export interface ExceptionFilter {
  catch(error: Error, ctx: HttpContext): void | Promise<void>;
}

export type ExceptionFilterType =
  | ExceptionFilter
  | Constructor<ExceptionFilter>;
