import type { MiddlewareHandler, Guard, ExceptionFilter } from "../types.js";

export interface RouteMetadata {
  method: string;
  path: string;
  handlerName: string | symbol;
}

export interface ControllerMetadata {
  basePath: string;
  routes: RouteMetadata[];
  classMiddleware?: MiddlewareHandler[];
  classGuards?: Guard[];
  classFilters?: ExceptionFilter[];
  methodMiddleware?: Map<string | symbol, MiddlewareHandler[]>;
  methodGuards?: Map<string | symbol, Guard[]>;
  methodFilters?: Map<string | symbol, ExceptionFilter[]>;
}
