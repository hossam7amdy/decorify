import "./symbol-metadata-polyfill.js";

export type {
  Token,
  Provider,
  Constructor,
  ClassProvider,
  ValueProvider,
  ExistingProvider,
  FactoryProvider,
} from "./types.js";

export { Lifetime } from "./lifetime.js";

export { InjectionToken } from "./injection-token.js";

export { DI_INJECTABLE, DI_INJECT_TOKENS, DI_LIFETIME } from "./metadata.js";

export { inject, injectAsync, injectionContext as _injectionContext } from "./context.js";

export { Injectable, Inject } from "./decorators.js";

export { Container } from "./container.js";

export {
  DIError,
  DISuppressedError,
  MissingStrategyError,
  DuplicateTokenError,
  ContainerDisposedError,
  NoProviderError,
  ScopedResolutionError,
  CircularDependencyError,
  CaptiveDependencyError,
  AsyncFactoryError,
  InjectionContextError,
} from "./errors.js";
