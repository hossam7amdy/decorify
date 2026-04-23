import type { Handler } from "./http/adapter.ts";
import type { HttpContext } from "./http/context.ts";

export type Next = () => Promise<unknown>;
export type Middleware<TReq = unknown, TRes = unknown> = (
  ctx: HttpContext<TReq, TRes>,
  next: Next,
) => Promise<unknown> | unknown;

/** Koa-style onion composition. */
export function compose(
  middlewares: readonly Middleware[],
): (ctx: HttpContext, handler: Handler) => Promise<unknown> {
  return (ctx, handler) => {
    let lastIndex = -1;
    const dispatch = (i: number): Promise<unknown> => {
      if (i <= lastIndex)
        return Promise.reject(new Error("next() called multiple times"));
      lastIndex = i;
      const fn =
        i === middlewares.length ? () => handler(ctx) : middlewares.at(i)!;
      try {
        return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    };
    return dispatch(0);
  };
}
