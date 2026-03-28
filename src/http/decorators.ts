(Symbol as any).metadata ??= Object.create({});

import type { RouteMetadata } from "./metadata.js";

function createRouteDecorator(httpMethod: string) {
  return function (path = "") {
    return function (_value: unknown, context: DecoratorContext) {
      if (context.kind !== "method") {
        throw new Error(
          `@${httpMethod.toUpperCase()} can only be used on methods.`,
        );
      }

      context.metadata.routes ??= [];
      (context.metadata.routes as Array<RouteMetadata>).push({
        method: httpMethod,
        path: path,
        handlerName: context.name,
      });
    };
  };
}

export const Get = createRouteDecorator("get");
export const Post = createRouteDecorator("post");
export const Put = createRouteDecorator("put");
export const Delete = createRouteDecorator("delete");
export const Patch = createRouteDecorator("patch");

export function Controller(basePath = "") {
  return function (_value: unknown, context: ClassDecoratorContext) {
    if (context.kind !== "class") {
      throw new Error("@Controller can only be used on classes.");
    }
    context.metadata.basePath = basePath;
  };
}
