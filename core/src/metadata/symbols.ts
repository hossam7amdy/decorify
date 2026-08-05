// The polyfill is loaded here, and only here, so that `Symbol.metadata` exists
// before any decorated class is defined. Every accessor needs a key from this
// file, so the import is load-bearing: there is no way to reach metadata
// without first running the polyfill.
import "../../metadata-polyfill.js";

/** @internal */
export const INJECT_METADATA: unique symbol = Symbol("decorify:inject");

/** @internal */
export const INJECTABLE_METADATA: unique symbol = Symbol("decorify:injectable");

/** @internal */
export const MODULE_METADATA: unique symbol = Symbol("decorify:module");

/** @internal */
export const DECORIFY_KEYS = Object.freeze([
  INJECT_METADATA,
  INJECTABLE_METADATA,
  MODULE_METADATA,
] as const);
