import "./symbol-metadata-polyfill.js";

// Core
export { Application } from "./application.js";
export type {
  HttpContext,
  InjectableContext,
  ResolvedContext,
} from "./context.js";
export type {
  HttpAdapter,
  InjectableAdapter,
  ResolvedAdapter,
} from "./adapters/http-adapter.js";

// HTTP types
export type {
  RouteHandler,
  MiddlewareHandler,
  ErrorHandler,
  Guard,
  ExceptionFilter,
} from "./types.js";

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
