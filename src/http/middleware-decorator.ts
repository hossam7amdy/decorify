import type { MiddlewareHandler, Guard, ExceptionFilter } from "../types.js";

/**
 * Attach middleware to a controller class or a specific method.
 * Middleware runs in order, before the route handler.
 */
export function UseMiddleware(...middleware: MiddlewareHandler[]) {
  return function (_value: unknown, context: DecoratorContext) {
    if (context.kind !== "class" && context.kind !== "method") {
      throw new Error("@UseMiddleware can only be used on classes or methods.");
    }

    if (context.kind === "class") {
      context.metadata.classMiddleware ??= [];
      (context.metadata.classMiddleware as MiddlewareHandler[]).push(
        ...middleware,
      );
    } else {
      const map =
        (context.metadata.methodMiddleware as Map<
          string | symbol,
          MiddlewareHandler[]
        >) ?? new Map<string | symbol, MiddlewareHandler[]>();
      const existing = map.get(context.name) ?? [];
      existing.push(...middleware);
      map.set(context.name, existing);
      context.metadata.methodMiddleware = map;
    }
  };
}

/**
 * Attach guards to a controller class or a specific method.
 * Guards run after middleware and before the route handler.
 * If any guard returns false, a ForbiddenException is thrown.
 */
export function UseGuard(...guards: Guard[]) {
  return function (_value: unknown, context: DecoratorContext) {
    if (context.kind !== "class" && context.kind !== "method") {
      throw new Error("@UseGuard can only be used on classes or methods.");
    }

    if (context.kind === "class") {
      context.metadata.classGuards ??= [];
      (context.metadata.classGuards as Guard[]).push(...guards);
    } else {
      const map =
        (context.metadata.methodGuards as Map<string | symbol, Guard[]>) ??
        new Map<string | symbol, Guard[]>();
      const existing = map.get(context.name) ?? [];
      existing.push(...guards);
      map.set(context.name, existing);
      context.metadata.methodGuards = map;
    }
  };
}

/**
 * Attach exception filters to a controller class or a specific method.
 * Filters catch errors thrown by guards or the route handler.
 * Method-level filters are checked before class-level filters.
 */
export function UseFilter(...filters: ExceptionFilter[]) {
  return function (_value: unknown, context: DecoratorContext) {
    if (context.kind !== "class" && context.kind !== "method") {
      throw new Error("@UseFilter can only be used on classes or methods.");
    }

    if (context.kind === "class") {
      context.metadata.classFilters ??= [];
      (context.metadata.classFilters as ExceptionFilter[]).push(...filters);
    } else {
      const map =
        (context.metadata.methodFilters as Map<
          string | symbol,
          ExceptionFilter[]
        >) ?? new Map<string | symbol, ExceptionFilter[]>();
      const existing = map.get(context.name) ?? [];
      existing.push(...filters);
      map.set(context.name, existing);
      context.metadata.methodFilters = map;
    }
  };
}
