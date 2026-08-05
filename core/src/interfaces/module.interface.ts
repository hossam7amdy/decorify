import type { Constructor, Token } from "injectus";

import type { Provider } from "./provider.interface.ts";

export type ModuleEntry = Constructor | DynamicModule | Promise<DynamicModule>;

/** What a module contributes to the application graph. */
export interface ModuleMetadata {
  /**
   * Modules this one depends on.
   *
   * A bare class records an edge. A `DynamicModule` also configures the module
   * it names, and may be promised — discovery awaits it. Configure a module at
   * one import site: a second, different configuration of the same class is
   * `DECORIFY_E_DYNAMIC_CONFLICT`, because one injector cannot hold both.
   */
  imports?: Array<ModuleEntry>;

  /** Endpoints. Registered like providers, but never injectable themselves. */
  controllers?: Constructor[];

  providers?: Provider[];

  /**
   * Tokens importers may depend on. Re-exporting a token received from an
   * import is allowed; exporting one this module neither provides nor receives
   * is `DECORIFY_E_INVALID_EXPORT`.
   *
   * A checker boundary, not a container one — the injector is flat, so
   * `app.get()` reaches any token whether or not it is exported.
   */
  exports?: Token[];
}

/** A module configured at import time, usually by a static method on the class. */
export interface DynamicModule extends ModuleMetadata {
  /** The class being configured. Its static `@Module` metadata is kept and extended. */
  module: Constructor;
}
