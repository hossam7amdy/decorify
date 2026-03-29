import "./symbol-metadata-polyfill.js";

// Core
export { Application } from "./application.js";
export type { HttpContext } from "./context.js";
export type { HttpAdapter } from "./adapters/http-adapter.js";

// Types
export type {
  Constructor,
  Token,
  Lifetime,
  Provider,
  AsyncInitializable,
  RouteHandler,
  MiddlewareHandler,
  ErrorHandler,
  Guard,
  ExceptionFilter,
} from "./types.js";

// DI
export {
  container,
  Injectable,
  inject,
  Inject,
  Container,
} from "./di/index.js";

// HTTP Decorators
export {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  UseMiddleware,
  UseGuard,
  UseFilter,
} from "./http/index.js";
export type { RouteMetadata, ControllerMetadata } from "./http/index.js";

// Errors
export {
  HttpException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  DefaultExceptionFilter,
} from "./errors/index.js";

// Lifecycle
export type { OnInit, OnDestroy } from "./lifecycle/index.js";
