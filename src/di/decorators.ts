import type { Constructor } from "../types.js";
import { container } from "./container.js";

/**
 * Marks a class as injectable and registers it in the DI container.
 */
export function Injectable() {
  return function <T extends Constructor>(
    value: T,
    _context: ClassDecoratorContext<T>,
  ) {
    container.register(value);
  };
}

/**
 * Functional injection — resolves a dependency from the DI container.
 * Must be called inside an injection context (field initializer or constructor
 * of a class being resolved by the container).
 *
 * Usage:
 *   class UserController {
 *     private userService = inject(UserService);
 *   }
 */
export function inject<T>(token: Constructor<T>): T {
  if (!container.isInInjectionContext) {
    throw new Error(
      `[DI] inject(${token.name}) must be called from an injection context.`,
    );
  }
  return container.resolve(token);
}

/**
 * Field decorator that resolves a dependency from the DI container.
 *
 * Usage:
 *   @Inject(UserService) userService!: UserService;
 */
export function Inject<T>(token: Constructor<T>) {
  return function (_value: undefined, _context: ClassFieldDecoratorContext) {
    return function (this: any): T {
      return container.resolve(token);
    };
  };
}
