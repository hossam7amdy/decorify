import type { Constructor } from "injectus";

import type { ModuleMetadata } from "../interfaces/module.interface.ts";
import { MODULE_METADATA } from "./symbols.ts";

/** @internal */
export function ensureModuleMetadata(
  metadata: DecoratorMetadata,
): ModuleMetadata {
  if (!Object.hasOwn(metadata, MODULE_METADATA)) {
    metadata[MODULE_METADATA] = {} satisfies ModuleMetadata;
  }
  return metadata[MODULE_METADATA] as ModuleMetadata;
}

/** @internal */
export function getModuleMetadata(
  metadata: DecoratorMetadata,
): ModuleMetadata | undefined {
  return Object.hasOwn(metadata, MODULE_METADATA)
    ? (metadata[MODULE_METADATA] as ModuleMetadata)
    : undefined;
}

/** @internal */
export function readModuleMetadata(
  ctor: Constructor,
): ModuleMetadata | undefined {
  const metadata = ctor[Symbol.metadata];
  return metadata ? getModuleMetadata(metadata) : undefined;
}
