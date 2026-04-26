import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type { HttpAdapter, RouteDefinition } from "@decorify/core";
import type { FastifyAdapterOptions } from "./type.ts";
import { buildContext } from "./build-context.ts";

export class FastifyAdapter implements HttpAdapter<FastifyInstance> {
  readonly native: FastifyInstance;
  #routes: RouteDefinition[] = [];
  #listening = false;

  constructor(opts: FastifyAdapterOptions = {}) {
    const { instance, bodyLimit } = opts;
    this.native =
      instance ??
      Fastify({
        bodyLimit: bodyLimit ?? 100_000,
      });
  }

  registerRoute(route: RouteDefinition): void {
    if (this.#listening) {
      throw new Error(
        "Cannot register routes after the server has started listening",
      );
    }
    this.#routes.push(route);
  }

  async listen(port: number, host: string = "0.0.0.0"): Promise<number> {
    if (this.#listening) {
      const address = this.native.server.address();
      const currentPort =
        address && typeof address !== "string" ? address.port : 0;
      throw new Error(`Server is already listening on ${currentPort}`);
    }

    // Flush buffered routes
    for (const route of this.#routes) {
      this.native.route({
        method: route.method,
        url: route.path,
        handler: async (request, reply) => {
          const ctx = buildContext(request, reply);
          await route.handler(ctx);
          return reply;
        },
      });
    }

    this.#listening = true;
    await this.native.listen({ port, host });

    const address = this.native.server.address();
    return address && typeof address !== "string" ? address.port : 0;
  }

  async close(): Promise<void> {
    if (!this.#listening) return;
    this.#listening = false;
    await this.native.close();
  }
}
