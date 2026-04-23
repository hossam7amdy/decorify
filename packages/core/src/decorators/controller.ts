import { DI_INJECTABLE, DI_LIFETIME, Lifetime } from "@decorify/di";

export const CONTROLLER_META = Symbol.for("decorify.controller.metadata");

export interface ControllerMeta {
  prefix?: string;
}

export function Controller(prefix?: string) {
  return function (_target: unknown, context: ClassDecoratorContext): void {
    if (context.kind !== "class") {
      throw new Error("@Controller can only be used on classes.");
    }
    context.metadata[DI_INJECTABLE] = true;
    context.metadata[DI_LIFETIME] = Lifetime.SINGLETON;
    context.metadata[CONTROLLER_META] = {
      prefix,
    };
  };
}
