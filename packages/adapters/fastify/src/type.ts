import type { HttpContext } from "@decorify/core";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export type FastifyContext = HttpContext<FastifyRequest, FastifyReply>;

export interface FastifyAdapterOptions {
  instance?: FastifyInstance;
  /** Defaults to 100_000 (100kb) */
  bodyLimit?: number;
}
