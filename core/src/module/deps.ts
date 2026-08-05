import { type Constructor, Lifetime, type Token } from "injectus";

import type { Provider } from "../interfaces/provider.interface.ts";
import { readInjectMetadata } from "../metadata/inject.metadata.ts";
import { readInjectableMetadata } from "../metadata/injectable.metadata.ts";

/** Which of the five provider shapes a registration uses. */
export type ProviderKind = "class" | "value" | "factory" | "existing";

/** Classify a provider by shape. */
export function getProviderKind(provider: Provider): ProviderKind {
  if (typeof provider === "function") return "class";
  if ("useValue" in provider) return "value";
  if ("useClass" in provider) return "class";
  if ("useFactory" in provider) return "factory";
  return "existing";
}

/** The token a provider registers under. */
export function getProviderToken(provider: Provider): Token {
  return typeof provider === "function" ? provider : provider.provide;
}

/**
 * Every token a provider depends on, read from declared metadata.
 *
 * Field injection is declared by `@Inject`, factories by their `inject` array,
 * and aliases by their target. A bare `inject()` call inside a field
 * initializer is invisible here.
 */
export function getProviderDeps(provider: Provider): Token[] {
  if (typeof provider === "function") return fieldDeps(provider);
  if ("useClass" in provider) return fieldDeps(provider.useClass);
  if ("useFactory" in provider) return [...(provider.inject ?? [])];
  if ("useExisting" in provider) return [provider.useExisting];
  return [];
}

/** A provider's effective lifetime, defaulting to `Singleton`. */
export function getProviderLifetime(provider: Provider): Lifetime {
  if (typeof provider === "function") {
    return readInjectableMetadata(provider)?.lifetime ?? Lifetime.Singleton;
  }
  if ("lifetime" in provider && provider.lifetime !== undefined) {
    return provider.lifetime;
  }
  return Lifetime.Singleton;
}

function fieldDeps(ctor: Constructor): Token[] {
  return readInjectMetadata(ctor)?.map((entry) => entry.token) ?? [];
}
