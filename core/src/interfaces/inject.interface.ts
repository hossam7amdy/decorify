import type { Token } from "injectus";

/** @internal Field-injection edges recorded by `@Inject`, in declaration order. */
export type InjectMetadata = Array<{
  name: string | symbol;
  token: Token;
}>;
