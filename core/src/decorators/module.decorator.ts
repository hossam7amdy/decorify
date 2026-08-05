import type { ModuleMetadata } from "../interfaces/module.interface.ts";
import { ensureModuleMetadata } from "../metadata/module.metadata.ts";

/**
 * Declare a module: one node in the application graph.
 *
 * @example
 * ```ts
 * @Module({
 *   imports: [ConfigModule],
 *   providers: [UserService],
 *   controllers: [UserController],
 *   exports: [UserService],
 * })
 * class UserModule {}
 * ```
 */
export function Module(metadata: ModuleMetadata) {
  return (_: unknown, context: ClassDecoratorContext) => {
    const current = ensureModuleMetadata(context.metadata);
    Object.assign(current, { ...metadata });
  };
}
