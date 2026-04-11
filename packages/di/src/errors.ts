import type { Token } from "./types.js";
import type { Lifetime } from "./lifetime.js";
import { tokenName } from "./utils.js";

const prefix = "[DI] ";

export class DIError extends Error {
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(prefix + message);
    this.name = this.constructor.name;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.constructor.name,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export class DISuppressedError extends DIError {
  readonly error: unknown;
  readonly suppressed: unknown;

  constructor(error: unknown, suppressed: unknown, message: string) {
    super(prefix + message);
    this.error = error;
    this.suppressed = suppressed;
  }
}

export class MissingStrategyError extends DIError {
  constructor(token: Token) {
    super(
      `Provider for "${tokenName(token)}" is missing a strategy. ` +
        `Specify one of: useClass, useValue, useFactory, or useExisting.`,
    );
  }
}

export class DuplicateTokenError extends DIError {
  constructor(token: Token) {
    super(
      `Token "${tokenName(token)}" is already registered. Pass { override: true } to replace it.`,
    );
  }
}

export class ContainerDisposedError extends DIError {
  constructor(token?: Token) {
    const tokenMessage = token
      ? ` Cannot resolve token "${tokenName(token)}".`
      : "";
    super(`Container is disposed or being disposed.${tokenMessage}`);
  }
}

export class NoProviderError extends DIError {
  constructor(token: Token) {
    super(
      `No provider registered for ${tokenName(token)}. Did you forget @Injectable() or container.register()?`,
    );
  }
}

export class ScopedResolutionError extends DIError {
  constructor(token: Token) {
    super(
      `Cannot resolve scoped token "${tokenName(token)}" from root container. Use createScope().`,
    );
  }
}

export class CircularDependencyError extends DIError {
  constructor(cycle: string) {
    super(`Circular dependency detected: ${cycle}`);
  }
}

export class CaptiveDependencyError extends DIError {
  constructor(
    parentLifetime: Lifetime,
    parentToken: Token,
    childLifetime: Lifetime,
    childToken: Token,
  ) {
    super(
      `Captive dependency detected: ${parentLifetime} "${tokenName(parentToken)}" depends on ${childLifetime} "${tokenName(childToken)}". A longer-lived service must not capture a shorter-lived one.`,
    );
  }
}

export class AsyncFactoryError extends DIError {
  constructor(token: Token) {
    super(
      `Factory for "${tokenName(token)}" returned a Promise. Use resolveAsync() instead.`,
    );
  }
}

export class InjectionContextError extends DIError {
  constructor(fn: "inject" | "injectAsync") {
    super(
      `${fn}() called outside of an injection context. ` +
        `It can only be used inside a class constructor or factory function ` +
        `that is being resolved by the DI container.`,
    );
  }
}

export class InitializeError extends DIError {
  readonly errors: Array<{ token: Token; error: unknown }>;
  constructor(errors: InitializeError["errors"]) {
    const summary = errors
      .map(
        ({ token, error }) =>
          `  - ${tokenName(token)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
      )
      .join("\n");
    super(`initialize() failed for ${errors.length} provider(s):\n${summary}`);
    this.errors = errors;
  }

  override toJSON() {
    return {
      name: this.constructor.name,
      message: this.message,
      errors: this.errors,
    };
  }
}
