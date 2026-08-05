import type { Provider as _Provider } from "injectus";
import { inject } from "injectus";

import type { Provider } from "../interfaces/provider.interface.ts";
import { readInjectableMetadata } from "../metadata/injectable.metadata.ts";

/** @internal Normalize a decorify provider into the shape injectus registers. */
export function toInjectorProvider<T>(provider: Provider<T>): _Provider<T> {
  if (typeof provider === "function") {
    return {
      provide: provider,
      useClass: provider,
      ...readInjectableMetadata(provider),
    };
  } else if (
    "useFactory" in provider &&
    typeof provider.useFactory === "function"
  ) {
    return {
      ...provider,
      useFactory: () => {
        const deps = provider.inject?.map((token) => inject(token));
        return provider.useFactory(...(deps ?? []));
      },
    };
  }
  return provider;
}
