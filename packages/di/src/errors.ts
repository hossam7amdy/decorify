import type { Token } from "./types.js";
import type { Lifetime } from "./lifetime.js";
import { tokenName } from "./utils.js";

const prefix = "[DI] ";

export abstract class DIError extends Error {
  constructor(message: string) {
    super(prefix + message);
    this.name = this.constructor.name;
  }
}

export class DISuppressedError extends SuppressedError {
  constructor(error: unknown, suppressed: unknown, message: string) {
    super(error, suppressed, prefix + message);
    this.name = this.constructor.name;
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
  constructor(token: Token) {
    super(
      `Container is disposed or being disposed. Cannot resolve token "${tokenName(token)}".`,
    );
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
