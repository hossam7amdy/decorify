import type { Middleware } from "../middleware.ts";

export const CONTROLLER_MIDDLEWARE = Symbol.for(
  "decorify.controller.middleware",
);
export const ROUTE_MIDDLEWARE = Symbol.for("decorify.route.middleware");

export type RouteMiddlewareMap = Map<string | symbol, Middleware[]>;

export function UseMiddleware(...middlewares: Middleware[]) {
  return function (
    _target: unknown,
    context: ClassDecoratorContext | ClassMethodDecoratorContext,
  ): void {
    if (context.kind === "class") {
      context.metadata[CONTROLLER_MIDDLEWARE] ??= [];
      (context.metadata[CONTROLLER_MIDDLEWARE] as Middleware[]).push(
        ...middlewares,
      );
      return;
    }

    if (context.kind === "method") {
      if (context.static || context.private) {
        throw new Error(
          "@UseMiddleware on methods must target public instance methods",
        );
      }
      context.metadata[ROUTE_MIDDLEWARE] ??= new Map();
      const map = context.metadata[ROUTE_MIDDLEWARE] as RouteMiddlewareMap;
      const existing = map.get(context.name) ?? [];
      map.set(context.name, [...existing, ...middlewares]);
      return;
    }

    throw new Error("@UseMiddleware can only be applied to classes or methods");
  };
}
