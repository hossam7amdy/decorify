import type { HttpContext } from "../http/context.ts";
import { HttpException } from "./http-exception.ts";

export type ErrorHandler = (
  err: unknown,
  ctx: HttpContext,
) => unknown | Promise<unknown>;

export const defaultErrorHandler: ErrorHandler = async (err, ctx) => {
  if (ctx.res.sent) return;
  if (err instanceof HttpException) {
    return ctx.res.status(err.status).json(err.toJSON());
  }
  ctx.res.status(500).json({
    error: (err as Error)?.message ?? "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && {
      stack: (err as Error)?.stack,
    }),
  });
};
