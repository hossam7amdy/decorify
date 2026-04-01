export { inject } from "./context.js";
import { inject } from "./context.js";
import { DI_INJECTABLE, DI_INJECT_TOKENS, DI_SCOPE } from "./metadata.js";
import type { Token } from "./types.js";
import type { Lifetime } from "./lifetime.js";

/**
 * Marks a class as injectable. Required for the container to instantiate it.
 *
 * @example
 *
 * @Injectable()
 * class UserService { ... }
 *
 * @Injectable({ lifetime: Lifetime.TRANSIENT })
 * class RequestLogger { ... }
 *
 */
export function Injectable(opts?: { lifetime?: Lifetime }) {
  return function (_target: any, context: ClassDecoratorContext) {
    context.metadata[DI_INJECTABLE] = true;
    if (opts?.lifetime) {
      context.metadata[DI_SCOPE] = opts.lifetime;
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
    context.metadata[DI_INJECT_TOKENS] = existing;

    // Return an initializer that resolves from the current injection context
    return function (this: any) {
      return inject(token);
    };
  };
}
