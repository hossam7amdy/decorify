import type {
  MiddlewareHandler,
  GuardType,
  ExceptionFilterType,
} from "../types.js";

export interface RouteMetadata {
  method: string;
  path: string;
  handlerName: string | symbol;
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
}
