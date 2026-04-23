import "./symbol-metadata-polyfill.ts";

// Core
export { Application, type ApplicationOptions } from "./application.ts";
export type { Next, Middleware } from "./middleware.ts";
export { type ModuleDefinition, defineModule } from "./module.ts";

// Decorators
export {
  CONTROLLER_MIDDLEWARE,
  ROUTE_MIDDLEWARE,
  UseMiddleware,
  Route,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Controller,
  ROUTE_META,
  CONTROLLER_META,
} from "./decorators/index.ts";
export type { RouteMeta, ControllerMeta } from "./decorators/index.ts";

// HTTP
export { HttpStatus } from "./http/index.ts";
export type {
  Handler,
  HttpMethod,
  RouteDefinition,
  HttpAdapter,
  HttpContext,
  HttpRequest,
  HttpResponse,
} from "./http/index.ts";

// Errors
export {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  MethodNotAllowedException,
  ConflictException,
  UnprocessableEntityException,
  TooManyRequestsException,
  InternalServerErrorException,
  defaultErrorHandler,
} from "./errors/index.ts";

// Re-export DI utilities
export * from "@decorify/di";
