import type { Constructor } from "injectus";

import type { InjectMetadata } from "../interfaces/inject.interface.ts";
import { INJECT_METADATA } from "./symbols.ts";

export function ensureInjectMetadata(
  metadata: DecoratorMetadata,
): InjectMetadata {
  if (!Object.hasOwn(metadata, INJECT_METADATA)) {
    metadata[INJECT_METADATA] = [] satisfies InjectMetadata;
  }
  return metadata[INJECT_METADATA] as InjectMetadata;
}

export function getInjectMetadata(
  metadata: DecoratorMetadata,
): InjectMetadata | undefined {
  // Own-key only. A decorated subclass is refused at decoration time, so the
  // one hierarchy that reaches here is an undecorated subclass, whose
  // `ctor[Symbol.metadata]` already resolves to its ancestor's own object.
  return Object.hasOwn(metadata, INJECT_METADATA)
    ? (metadata[INJECT_METADATA] as InjectMetadata)
    : undefined;
}

/** @internal */
export function readInjectMetadata(
  ctor: Constructor,
): InjectMetadata | undefined {
  const metadata = ctor[Symbol.metadata];
  return metadata ? getInjectMetadata(metadata) : undefined;
}
