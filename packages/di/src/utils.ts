import type { Token } from "./types.js";
import { InjectionToken } from "./injection-token.js";

export function tokenName(token: Token): string {
  if (token instanceof InjectionToken)
    return `InjectionToken(${token.description})`;
  if (typeof token === "function") return token.name;
  return String(token);
}
