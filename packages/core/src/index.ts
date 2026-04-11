import "./symbol-metadata-polyfill.js";

// Core
export { Application } from "./application.js";
export type { HttpContext, InjectableContext } from "./context.js";
export type { HttpAdapter } from "./adapters/http-adapter.js";

// HTTP types
export type {
  RouteHandler,
  MiddlewareHandler,
  ErrorHandler,
  Guard,
  ExceptionFilter,
} from "./types.js";

// HTTP Decorators
export { HttpStatus } from "./http/index.js";
export {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Head,
  Options,
  All,
  UseMiddleware,
  UseGuard,
  UseFilter,
  ValidateBody,
  ValidateParams,
  ValidateQuery,
} from "./http/index.js";
export type { RouteMetadata, ControllerMetadata } from "./http/index.js";

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
  DefaultExceptionFilter,
} from "./errors/index.js";

// Lifecycle
export type { OnInit, OnDestroy } from "./lifecycle/index.js";
export {
  hasOnInit,
  hasOnDestroy,
  LifecycleManager,
} from "./lifecycle/index.js";

// Re-export DI utilities
export {
  Container,
  Injectable,
  Inject,
  injectAsync,
  inject,
  InjectionToken,
  Lifetime,
} from "@decorify/di";
export type {
  Token,
  Provider,
  Constructor,
  ClassProvider,
  ValueProvider,
  ExistingProvider,
  FactoryProvider,
} from "@decorify/di";
