import type { HttpAdapter } from "./adapters/http-adapter.js";
import type { HttpContext } from "./context.js";
import type {
  RouteHandler,
  MiddlewareHandler,
  Guard,
  ExceptionFilter,
} from "./types.js";
import type { ControllerMetadata } from "./http/metadata.js";
import type { Constructor } from "@decorify/di";
import { ForbiddenException } from "./errors/http-exception.js";
import { DefaultExceptionFilter } from "./errors/exception-filter.js";
import { Container } from "@decorify/di";
import { LifecycleManager } from "./lifecycle/manager.js";

export interface RouterOptions {
  globalMiddleware: MiddlewareHandler[];
  globalGuards: Guard[];
  globalFilters: ExceptionFilter[];
}

export function registerControllers(
  container: Container,
  adapter: HttpAdapter,
  controllers: Constructor[],
  lifecycle: LifecycleManager,
  options: RouterOptions,
): void {
  const defaultFilter = new DefaultExceptionFilter();

  for (const ControllerClass of controllers) {
    const instance = container.resolve<any>(ControllerClass);
    lifecycle.track(instance);

    const metadata: ControllerMetadata | undefined = (ControllerClass as any)[
      (Symbol as any).metadata
    ];

    if (!metadata) {
      console.warn(
        `Class ${ControllerClass.name} has no metadata. Did you forget @Controller?`,
      );
      continue;
    }

    const basePath = metadata.basePath || "";
    const routes = [...(metadata.routes || [])];

    // Sort routes: static paths before parameterized ones (e.g., /error before /:id)
    routes.sort((a, b) => {
      const aHasParam = a.path.includes(":");
      const bHasParam = b.path.includes(":");
      if (aHasParam !== bHasParam) return aHasParam ? 1 : -1;
      return 0;
    });

    for (const route of routes) {
      const fullPath = `${basePath}${route.path}`.replace(/\/+/g, "/");

      // Collect middleware: global → class → method
      const middleware: MiddlewareHandler[] = [
        ...options.globalMiddleware,
        ...(metadata.classMiddleware ?? []),
        ...(metadata.methodMiddleware?.get(route.handlerName) ?? []),
      ];

      // Collect guards: global → class → method
      const guards: Guard[] = [
        ...options.globalGuards,
        ...(metadata.classGuards ?? []),
        ...(metadata.methodGuards?.get(route.handlerName) ?? []),
      ];

      // Collect filters: method → class → global (first match wins)
      const filters: ExceptionFilter[] = [
        ...(metadata.methodFilters?.get(route.handlerName) ?? []),
        ...(metadata.classFilters ?? []),
        ...options.globalFilters,
        defaultFilter,
      ];

      const rawHandler: RouteHandler = async (ctx: HttpContext) => {
        const result = await (instance[route.handlerName] as Function).call(
          instance,
          ctx,
        );
        // Auto-serialize return values as JSON
        if (result !== undefined) {
          ctx.json(result);
        }
      };

      const pipeline = buildPipeline(rawHandler, middleware, guards, filters);

      adapter.registerRoute(route.method, fullPath, pipeline);

      console.log(
        `[Router] Mapped {${fullPath}, ${route.method.toUpperCase()}} -> ${ControllerClass.name}.${String(route.handlerName)}`,
      );
    }
  }
}

function buildPipeline(
  handler: RouteHandler,
  middleware: MiddlewareHandler[],
  guards: Guard[],
  filters: ExceptionFilter[],
): RouteHandler {
  return async (ctx: HttpContext) => {
    try {
      // Run guards
      for (const guard of guards) {
        const allowed = await guard.canActivate(ctx);
        if (!allowed) {
          throw new ForbiddenException();
        }
      }

      // Build middleware chain (Koa-style onion)
      let index = -1;
      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error("next() called multiple times");
        }
        index = i;
        if (i === middleware.length) {
          // End of chain: call the route handler
          await handler(ctx);
          return;
        }
        await middleware[i]!(ctx, () => dispatch(i + 1));
      };

      await dispatch(0);
    } catch (error) {
      // Run exception filters (first one handles it)
      for (const filter of filters) {
        try {
          await filter.catch(error as Error, ctx);
          return;
        } catch {
          // Filter itself threw, try next filter
          continue;
        }
      }
    }
  };
}
