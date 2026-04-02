import type { ModuleMetadata } from "./metadata.js";
import { IS_MODULE, MODULE_METADATA } from "./metadata.js";

export function Module(metadata: ModuleMetadata) {
  return function (_value: unknown, context: ClassDecoratorContext) {
    if (context.kind !== "class") {
      throw new Error("@Module can only be used on classes.");
    }
    context.metadata[IS_MODULE] = true;
    context.metadata[MODULE_METADATA] = metadata;
  };
}
