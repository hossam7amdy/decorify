import type { HttpContext } from "../context.js";
import type { ExceptionFilter } from "../types.js";
import { HttpException } from "./http-exception.js";

export class DefaultExceptionFilter implements ExceptionFilter {
  catch(error: Error, ctx: HttpContext): void {
    if (error instanceof HttpException) {
      ctx.status(error.statusCode).json(error.toJSON());
    } else {
      console.error("[Error]", error);
      ctx.status(500).json({
        statusCode: 500,
        message: "Internal Server Error",
      });
    }
  }
}
