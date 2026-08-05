import type { InjectOptions, Injector, Token } from "injectus";

import type { ModuleEntry } from "../interfaces/module.interface.ts";
import { compile } from "./compile.ts";
import { type ControllerRef, collectControllers } from "./controller.ts";
import { discover } from "./discover.ts";
import { DecorifyValidationError } from "./errors.ts";
import type { ModuleGraph } from "./graph.ts";
import { instantiate } from "./instantiate.ts";
import { type SerializedGraph, snapshot } from "./snapshot.ts";
import { validate } from "./validate.ts";

/** A booted application: one injector, its graph, and its controllers. */
export class DecorifyApp implements AsyncDisposable {
  readonly injector: Injector;
  readonly graph: ModuleGraph;
  readonly controllers: readonly ControllerRef[];

  protected constructor(graph: ModuleGraph, injector: Injector) {
    this.graph = graph;
    this.injector = injector;
    this.controllers = collectControllers(graph);
  }

  /**
   * Discover, validate, and compile the module graph rooted at `root`.
   *
   * Every async step happens here, during discovery. What `create` returns
   * resolves synchronously from then on.
   *
   * @throws {DecorifyValidationError} when the graph fails any validation rule.
   */
  static async create(entry: ModuleEntry): Promise<DecorifyApp> {
    const graph = await discover(entry);

    const errors = validate(graph);
    if (errors.length > 0) {
      throw new DecorifyValidationError(errors);
    }

    const injector = compile(graph);
    instantiate(graph, injector);
    return new DecorifyApp(graph, injector);
  }

  /** Resolve a token from the root injector. */
  resolve<T>(token: Token<T>): T;
  resolve<T>(token: Token<T>, options: { optional: true }): T | null;
  resolve<T>(token: Token<T>, options?: InjectOptions): T | null {
    return this.injector.resolve(token, options);
  }

  /** Render the module graph as stable JSON, for tooling and diffing. */
  snapshot(): SerializedGraph {
    return snapshot(this.graph);
  }

  /**
   * Dispose every instance that implements `Symbol.dispose` or
   * `Symbol.asyncDispose`, in reverse construction order. Idempotent.
   */
  dispose(): Promise<void> {
    return this.injector.dispose();
  }

  [Symbol.asyncDispose](): Promise<void> {
    return this.dispose();
  }
}
