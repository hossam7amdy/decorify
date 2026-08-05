import type { Constructor } from "injectus";

import type { InjectableMetadata } from "../interfaces/injectable.interface.ts";
import { INJECTABLE_METADATA } from "./symbols.ts";

/** @internal */
export function ensureInjectableMetadata(
  metadata: DecoratorMetadata,
): InjectableMetadata {
  if (!Object.hasOwn(metadata, INJECTABLE_METADATA)) {
    metadata[INJECTABLE_METADATA] = {} satisfies InjectableMetadata;
  }
  return metadata[INJECTABLE_METADATA] as InjectableMetadata;
}

/** @internal */
export function getInjectableMetadata(
  metadata: DecoratorMetadata,
): InjectableMetadata | undefined {
  // Own-key only — see the note in `getInjectMetadata`.
  return Object.hasOwn(metadata, INJECTABLE_METADATA)
    ? (metadata[INJECTABLE_METADATA] as InjectableMetadata)
    : undefined;
}

/** @internal */
export function readInjectableMetadata(
  ctor: Constructor,
): InjectableMetadata | undefined {
  const metadata = ctor[Symbol.metadata];
  return metadata ? getInjectableMetadata(metadata) : undefined;
}
