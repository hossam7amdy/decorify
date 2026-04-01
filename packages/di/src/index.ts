import "./symbol-metadata-polyfill.js";

export type {
  Token,
  Provider,
  Constructor,
  ClassProvider,
  ValueProvider,
  ExistingProvider,
  FactoryProvider,
  OptionalFactoryDependency,
} from "./types.js";

export { Lifetime } from "./lifetime.js";

export { InjectionToken } from "./injection-token.js";

export { DI_INJECTABLE, DI_INJECT_TOKENS, DI_SCOPE } from "./metadata.js";

export { inject, injectionContext as _injectionContext } from "./context.js";

export { Injectable, Inject } from "./decorators.js";

export { Container } from "./container.js";
