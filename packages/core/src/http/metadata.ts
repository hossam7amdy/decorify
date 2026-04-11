import type {
  MiddlewareHandler,
  GuardType,
  ExceptionFilterType,
} from "../types.js";
import type { StandardSchemaV1 } from "../standard-schema.js";

export interface RouteMetadata {
  method: string;
  path: string;
  handlerName: string | symbol;
  bodySchema?: StandardSchemaV1;
  paramsSchema?: StandardSchemaV1;
  querySchema?: StandardSchemaV1;
}

export interface ControllerMetadata {
  basePath: string;
  routes: RouteMetadata[];
  classMiddleware?: MiddlewareHandler[];
  classGuards?: GuardType[];
  classFilters?: ExceptionFilterType[];
  methodMiddleware?: Map<string | symbol, MiddlewareHandler[]>;
  methodGuards?: Map<string | symbol, GuardType[]>;
  methodFilters?: Map<string | symbol, ExceptionFilterType[]>;
  methodBodySchemas?: Map<string | symbol, StandardSchemaV1>;
  methodParamsSchemas?: Map<string | symbol, StandardSchemaV1>;
  methodQuerySchemas?: Map<string | symbol, StandardSchemaV1>;
}
