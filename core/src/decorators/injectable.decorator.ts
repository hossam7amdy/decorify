import type { InjectableMetadata } from "../interfaces/injectable.interface.ts";
import { ensureInjectableMetadata } from "../metadata/injectable.metadata.ts";

/**
 * Set how long a provider's instance lives.
 *
 * Optional: a class listed in a module's `providers` is registered with or
 * without this decorator. Reach for it to opt out of `Lifetime.Singleton`.
 *
 * @example
 * ```ts
 * @Injectable({ lifetime: Lifetime.Scoped })
 * class RequestContext {}
 * ```
 */
export function Injectable(metadata?: InjectableMetadata) {
  return (_: unknown, context: ClassDecoratorContext) => {
    const current = ensureInjectableMetadata(context.metadata);
    Object.assign(current, { ...metadata });
  };
}
