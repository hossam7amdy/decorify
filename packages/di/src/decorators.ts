import type { Token, Scope } from "./types.js";
import { DI_INJECTABLE, DI_INJECT_TOKENS, DI_SCOPE } from "./metadata.js";
import { inject } from "./context.js";

export { inject } from "./context.js";

/**
 * Marks a class as injectable. Required for the container to instantiate it.
 *
 * @example
 *
 * @Injectable()
 * class UserService { ... }
 *
 * @Injectable({ scope: Scope.Transient })
 * class RequestLogger { ... }
 *
 */
export function Injectable(opts?: { scope?: Scope }) {
  return function (_target: any, context: ClassDecoratorContext) {
    (context.metadata[DI_INJECTABLE] as boolean) = true;
    if (opts?.scope) {
      (context.metadata[DI_SCOPE] as Scope) = opts.scope;
    }
  };
}

/**
 * Explicit token injection via parameter-level metadata.
 * Use as a field decorator (since native decorators don't support param decorators).
 *
 * @example
 * class UserService {
 *   @Inject(DB_URL) private dbUrl!: string;
 *   @Inject(LoggerService) private logger!: LoggerService;
 * }
 */
export function Inject<T>(token: Token<T>) {
  return function (_target: undefined, context: ClassFieldDecoratorContext) {
    // Store the token so the container can resolve it after construction
    const existing = (context.metadata[DI_INJECT_TOKENS] ?? {}) as Record<
      string | symbol,
      Token
    >;
    existing[context.name] = token;
    (context.metadata[DI_INJECT_TOKENS] as Record<string | symbol, Token>) =
      existing;

    // Return an initializer that resolves from the current injection context
    return function (this: any) {
      return inject(token);
    };
  };
}
