import type { Middleware } from "./middleware.ts";
import type { Provider, Constructor } from "@decorify/di";

export interface ModuleDefinition {
  readonly name: string;
  readonly providers?: readonly Provider[];
  readonly controllers?: readonly Constructor[];
  readonly middlewares?: readonly Middleware[];
}

export function defineModule(def: ModuleDefinition): ModuleDefinition {
  return def;
}
