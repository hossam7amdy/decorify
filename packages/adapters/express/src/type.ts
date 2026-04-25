import type { HttpContext } from "@decorify/core";
import type { Application, Request, Response } from "express";

export type ExpressContext = HttpContext<Request, Response>;

export interface ExpressAdapterOptions {
  application?: Application;
  /** Defaults to '100kb' */
  jsonLimit?: string;
}
