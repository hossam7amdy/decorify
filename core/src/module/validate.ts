import { type Constructor, Lifetime, type Token, tokenName } from "injectus";

import type { Provider } from "../interfaces/provider.interface.ts";
import {
  getProviderDeps,
  getProviderLifetime,
  getProviderToken,
} from "./deps.ts";
import type { DecorifyError } from "./errors.ts";
import type { ModuleGraph, ModuleNode } from "./graph.ts";

interface Declaration {
  provider: Provider;
  module: Constructor;
}

interface Scope {
  node: ModuleNode;
  /** Tokens this module may depend on. */
  visible: Set<Token>;
}

/**
 * Check a discovered graph against every rule the single-injector design requires.
 *
 * Returns every problem found; never throws and never stops at the first error.
 * A module import cycle is the one exception — it is reported alone, because the
 * remaining checks all read `graph.order`, which is empty when a cycle exists.
 */
export function validate(graph: ModuleGraph): DecorifyError[] {
  const errors: DecorifyError[] = [...graph.issues];
  if (graph.nodes.size > 0 && graph.order.length === 0) return errors;

  const declarations = new Map<Token, Declaration>();
  const controllerOwner = new Map<Token, Constructor>();
  const exported = new Map<Constructor, Set<Token>>();
  const scopes: Scope[] = [];

  // One pass, imports before importers: claim tokens, then resolve what each
  // module can see and re-export. Visibility only ever depends on modules
  // already visited, so a second pass would buy nothing.
  for (const node of graph.order) {
    const own = new Set<Token>();

    for (const provider of node.providers) {
      const token = getProviderToken(provider);
      const previous = declarations.get(token);
      if (previous) {
        errors.push({
          code: "DECORIFY_E_DUPLICATE_TOKEN",
          module: node.ref.name,
          token: tokenName(token),
          message: `${tokenName(token)} is provided by both ${previous.module.name} and ${node.ref.name}. decorify runs one injector, so a token can have only one provider.`,
        });
        continue;
      }
      declarations.set(token, { provider, module: node.ref });
      own.add(token);
    }

    for (const controller of node.controllers) {
      const previous = controllerOwner.get(controller);
      if (previous) {
        errors.push({
          code: "DECORIFY_E_DUPLICATE_TOKEN",
          module: node.ref.name,
          token: controller.name,
          message: `Controller ${controller.name} is declared by both ${previous.name} and ${node.ref.name}.`,
        });
        continue;
      }
      controllerOwner.set(controller, node.ref);
    }

    const inherited = new Set<Token>();
    for (const imported of node.imports) {
      for (const token of exported.get(imported) ?? []) inherited.add(token);
    }

    scopes.push({ node, visible: new Set([...own, ...inherited]) });

    const outward = new Set<Token>();
    for (const token of node.exports) {
      if (own.has(token) || inherited.has(token)) {
        outward.add(token);
        continue;
      }
      errors.push({
        code: "DECORIFY_E_INVALID_EXPORT",
        module: node.ref.name,
        token: tokenName(token),
        message: `${node.ref.name} exports ${tokenName(token)}, which it neither provides nor receives from an import.`,
      });
    }
    exported.set(node.ref, outward);
  }

  // Dependency edges need every declaration in hand, including ones made by
  // modules later in the order — otherwise a cross-module miss would be
  // reported as an unknown token rather than an invisible one.
  for (const { node, visible: reachable } of scopes) {
    const units: Provider[] = [...node.providers, ...node.controllers];
    for (const unit of units) {
      const lifetime = getProviderLifetime(unit);
      const name = tokenName(getProviderToken(unit));

      for (const dep of getProviderDeps(unit)) {
        const label = tokenName(dep);

        if (controllerOwner.has(dep)) {
          errors.push({
            code: "DECORIFY_E_CONTROLLER_INJECTED",
            module: node.ref.name,
            token: label,
            message: `${name} depends on ${label}, which is a controller. Controllers are endpoints, not dependencies.`,
          });
          continue;
        }

        const target = declarations.get(dep);
        if (!target) {
          errors.push({
            code: "DECORIFY_E_UNKNOWN_TOKEN",
            module: node.ref.name,
            token: label,
            message: `${name} depends on ${label}, which no module in the graph provides.`,
          });
          continue;
        }

        if (!reachable.has(dep)) {
          errors.push({
            code: "DECORIFY_E_NOT_VISIBLE",
            module: node.ref.name,
            token: label,
            message: `${name} depends on ${label}, provided by ${target.module.name}. ${node.ref.name} does not import a module that exports it.`,
          });
          continue;
        }

        if (
          lifetime === Lifetime.Singleton &&
          getProviderLifetime(target.provider) === Lifetime.Scoped
        ) {
          errors.push({
            code: "DECORIFY_E_CAPTIVE_DEPENDENCY",
            module: node.ref.name,
            token: label,
            message: `Singleton ${name} depends on scoped ${label}. The singleton would capture one request's instance forever.`,
          });
        }
      }
    }
  }

  return errors;
}
