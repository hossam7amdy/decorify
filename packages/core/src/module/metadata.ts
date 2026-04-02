import type { Constructor, Provider } from "@decorify/di";

export const IS_MODULE = Symbol("decorify:is_module");
export const MODULE_METADATA = Symbol("decorify:module_metadata");

export interface ModuleMetadata {
  imports?: Constructor[];
  controllers?: Constructor[];
  providers?: Provider[];
  exports?: Provider[];
}

export function isModule(target: Constructor): boolean {
  return (target as any)[Symbol.metadata]?.[IS_MODULE] === true;
}
