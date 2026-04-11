import { DI_INJECTABLE, DI_LIFETIME, Lifetime } from "@decorify/di";
import type { RouteMetadata } from "./metadata.js";
import type { StandardSchemaV1 } from "../standard-schema.js";

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
export const Head = createRouteDecorator("head");
export const Options = createRouteDecorator("options");
export const All = createRouteDecorator("all");

export function Controller(basePath = "") {
  return function (_value: unknown, context: ClassDecoratorContext) {
    if (context.kind !== "class") {
      throw new Error("@Controller can only be used on classes.");
    }
    context.metadata.basePath = basePath;
    context.metadata[DI_INJECTABLE] = true;
    context.metadata[DI_LIFETIME] = Lifetime.SINGLETON;
  };
}

function createValidationDecorator(metadataKey: string) {
  return function (schema: StandardSchemaV1) {
    return function (_value: unknown, context: DecoratorContext) {
      if (context.kind !== "method") {
        throw new Error(`@${metadataKey} can only be used on methods.`);
      }

      const map =
        (context.metadata[metadataKey] as Map<
          string | symbol,
          StandardSchemaV1
        >) ?? new Map<string | symbol, StandardSchemaV1>();
      map.set(context.name, schema);
      context.metadata[metadataKey] = map;
    };
  };
}

export const ValidateBody = createValidationDecorator("methodBodySchemas");
export const ValidateParams = createValidationDecorator("methodParamsSchemas");
export const ValidateQuery = createValidationDecorator("methodQuerySchemas");

interface ValidateOption {
  body?: StandardSchemaV1;
  params?: StandardSchemaV1;
  query?: StandardSchemaV1;
}

export const Validate = (options: ValidateOption) => {
  return function (value: unknown, context: DecoratorContext) {
    if (context.kind !== "method") {
      throw new Error("@Validate can only be used on methods.");
    }

    if (options.body) {
      ValidateBody(options.body)(value, context);
    }
    if (options.params) {
      ValidateParams(options.params)(value, context);
    }
    if (options.query) {
      ValidateQuery(options.query)(value, context);
    }
  };
};
