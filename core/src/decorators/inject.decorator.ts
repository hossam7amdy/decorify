import { inject, type Token } from "injectus";

import { ensureInjectMetadata } from "../metadata/inject.metadata.ts";

/**
 * Resolve `token` into a field when the injector constructs the class.
 *
 * The edge is written to the class's metadata at evaluation time, which is what
 * lets the graph be validated without instantiating anything. Stage-3 decorators
 * have no parameter decorators, so field injection is the only form decorify
 * offers.
 *
 * @example
 * ```ts
 * class UserService {
 *   @Inject(Database)
 *   db!: Database;
 * }
 * ```
 */
export function Inject<T>(token: Token<T>) {
  return <This>(_: This, context: ClassFieldDecoratorContext<This, T>) => {
    ensureInjectMetadata(context.metadata).push({
      name: context.name,
      token,
    });
    return () => inject(token);
  };
}
