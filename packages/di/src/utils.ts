import type {
  Token,
  Provider,
  Constructor,
  ValueProvider,
  ClassProvider,
  FactoryProvider,
  ExistingProvider,
} from "./types.js";
import { InjectionToken } from "./injection-token.js";

export function tokenName(token: Token): string {
  if (token instanceof InjectionToken)
    return `InjectionToken(${token.description})`;
  if (typeof token === "function") return token.name;
  return String(token);
}

export function isConstructorProvider<T>(
  provider: Provider<T>,
): provider is Constructor<T> {
  return typeof provider === "function";
}

export function isClassProvider<T>(
  provider: Provider<T>,
): provider is ClassProvider<T> {
  return "useClass" in provider;
}

export function isValueProvider<T>(
  provider: Provider<T>,
): provider is ValueProvider<T> {
  return "useValue" in provider;
}

export function isFactoryProvider<T>(
  provider: Provider<T>,
): provider is FactoryProvider<T> {
  return "useFactory" in provider;
}

export function isExistingProvider<T>(
  provider: Provider<T>,
): provider is ExistingProvider<T> {
  return "useExisting" in provider;
}

export function hasStrategy<T>(provider: Provider<T>) {
  return (
    isClassProvider(provider) ||
    isValueProvider(provider) ||
    isFactoryProvider(provider) ||
    isExistingProvider(provider)
  );
}
