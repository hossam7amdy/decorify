import type { Lifetime } from "injectus";

/** Options for {@link Injectable}. */
export interface InjectableMetadata {
  /** @default Lifetime.Singleton */
  lifetime?: Lifetime;
}
