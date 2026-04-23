import type { HttpMethod } from "../http/adapter.ts";

export const ROUTE_META = Symbol.for("decorify.routes");

export interface RouteMeta {
  method: HttpMethod;
  path: string;
  propertyKey: string | symbol;
}

export function Route(method: HttpMethod, path: string) {
  return function (
    _target: unknown,
    context: ClassMethodDecoratorContext,
  ): void {
    if (context.static || context.private) {
      throw new Error(`@${method} must target a public instance method`);
    }
    context.metadata[ROUTE_META] ??= [];
    (context.metadata[ROUTE_META] as RouteMeta[]).push({
      method,
      path,
      propertyKey: context.name,
    });
  };
}

export const Get = (path: string) => Route("GET", path);
export const Post = (path: string) => Route("POST", path);
export const Put = (path: string) => Route("PUT", path);
export const Patch = (path: string) => Route("PATCH", path);
export const Delete = (path: string) => Route("DELETE", path);
