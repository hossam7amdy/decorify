import type { Constructor, Provider, Token } from "@decorify/di";
import { Container } from "@decorify/di";
import { IS_MODULE, MODULE_METADATA } from "./metadata.js";
import type { ModuleMetadata } from "./metadata.js";

export function processModules(
  container: Container,
  rootModule: Constructor,
): Constructor[] {
  const processed = new Set<Constructor>();
  return processModule(container, rootModule, processed);
}

function processModule(
  container: Container,
  moduleClass: Constructor,
  processed: Set<Constructor>,
): Constructor[] {
  if (processed.has(moduleClass)) return [];
  processed.add(moduleClass);

  const meta = readModuleMetadata(moduleClass);
  const controllers: Constructor[] = [];

  // Process imports first (depth-first)
  for (const imported of meta.imports ?? []) {
    controllers.push(...processModule(container, imported, processed));
  }

  // Register providers (skip duplicates)
  for (const provider of meta.providers ?? []) {
    const token = extractToken(provider);
    if (!container.has(token)) {
      container.register(provider);
    }
  }

  // Collect controllers
  controllers.push(...(meta.controllers ?? []));

  return controllers;
}

function readModuleMetadata(moduleClass: Constructor): ModuleMetadata {
  const meta = (moduleClass as any)[Symbol.metadata];
  if (!meta?.[IS_MODULE]) {
    throw new Error(
      `Class "${moduleClass.name}" is not a module. Did you forget @Module()?`,
    );
  }
  return meta[MODULE_METADATA] as ModuleMetadata;
}

function extractToken(provider: Provider): Token {
  if (typeof provider === "function") return provider;
  return provider.provide;
}
