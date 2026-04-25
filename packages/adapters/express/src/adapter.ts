import express from "express";
import { Server } from "node:net";
import type { Application } from "express";
import type { HttpAdapter, RouteDefinition } from "@decorify/core";
import type { ExpressAdapterOptions } from "./type.ts";
import { buildContext } from "./build-context.ts";

export class ExpressAdapter implements HttpAdapter<Application> {
  #server?: Server;
  readonly native: Application;

  constructor(opts: ExpressAdapterOptions = {}) {
    const { application, jsonLimit } = opts;
    this.native = application ?? express();
    this.native.disable("x-powered-by");
    this.native.use(express.json({ limit: jsonLimit ?? "100kb" }));
    this.native.use(express.urlencoded({ extended: true }));
  }

  registerRoute(route: RouteDefinition): void {
    const method = route.method.toLowerCase() as Lowercase<
      RouteDefinition["method"]
    >;

    this.native[method](route.path, async (req, res, next) => {
      const ctx = buildContext(req, res);

      try {
        await Promise.resolve(route.handler(ctx));
      } catch (err) {
        next(err);
      }
    });
  }

  async listen(port: number, host: string = "0.0.0.0"): Promise<number> {
    if (this.#server) {
      throw new Error(
        `Server is already listening on ${getServerAddress(this.#server)}`,
      );
    }

    const server = (this.#server = this.native.listen(port, host));

    return new Promise((resolve, reject) => {
      server.once("listening", () => {
        resolve(getServerAddress(server));
      });
      server.once("error", (error) => {
        this.#server = undefined;
        reject(error);
      });
    });
  }

  async close(): Promise<void> {
    if (!this.#server) return;
    const server = this.#server;
    this.#server = undefined;
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

function getServerAddress(server: Server): number {
  const address = server.address();
  if (address && typeof address !== "string") {
    return address.port;
  }
  return 0;
}
