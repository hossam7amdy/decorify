import "./symbol-metadata-polyfill.js";

export type {
  Token,
  Scope,
  Provider,
  NormalizedProvider,
  Constructor,
  ProviderConfig,
  ClassProvider,
  ValueProvider,
  FactoryProvider,
  ExistingProvider,
  AsyncInitializable,
} from "./types.js";
export { Scope as ScopeValue, InjectionToken } from "./types.js";

export { DI_INJECTABLE, DI_INJECT_TOKENS, DI_SCOPE } from "./metadata.js";

export { inject, injectionContext as _injectionContext } from "./context.js";

export { Injectable, Inject } from "./decorators.js";

export { Container } from "./container.js";
