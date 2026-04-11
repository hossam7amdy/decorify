import type { HttpAdapter } from "./adapters/http-adapter.js";
import type { HttpContext } from "./context.js";
import type {
  RouteHandler,
  MiddlewareHandler,
  Guard,
  ExceptionFilter,
  GuardType,
  ExceptionFilterType,
} from "./types.js";
import type { ControllerMetadata } from "./http/metadata.js";
import type { Constructor } from "@decorify/di";
import {
  ForbiddenException,
  BadRequestException,
} from "./errors/http-exception.js";
import { DefaultExceptionFilter } from "./errors/exception-filter.js";
import { Container } from "@decorify/di";
import { LifecycleManager } from "./lifecycle/manager.js";
import type { StandardSchemaV1 } from "./standard-schema.js";

export interface RouterOptions {
  globalMiddleware: MiddlewareHandler[];
  globalGuards: GuardType[];
  globalFilters: ExceptionFilterType[];
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
      const rawGuards: GuardType[] = [
        ...options.globalGuards,
        ...(metadata.classGuards ?? []),
        ...(metadata.methodGuards?.get(route.handlerName) ?? []),
      ];

      const guards: Guard[] = rawGuards.map((g) => {
        if (typeof g === "function") {
          return container.resolve<Guard>(g as Constructor<Guard>);
        }
        return g;
      });

      // Collect filters: method → class → global (first match wins)
      const rawFilters: ExceptionFilterType[] = [
        ...(metadata.methodFilters?.get(route.handlerName) ?? []),
        ...(metadata.classFilters ?? []),
        ...options.globalFilters,
        defaultFilter,
      ];

      const filters: ExceptionFilter[] = rawFilters.map((f) => {
        if (typeof f === "function") {
          return container.resolve<ExceptionFilter>(
            f as Constructor<ExceptionFilter>,
          );
        }
        return f;
      });

      const bodySchema = metadata.methodBodySchemas?.get(route.handlerName);
      const paramsSchema = metadata.methodParamsSchemas?.get(route.handlerName);
      const querySchema = metadata.methodQuerySchemas?.get(route.handlerName);

      const rawHandler: RouteHandler = async (ctx: HttpContext) => {
        // Validation logic
        if (bodySchema) {
          (ctx as any).body = await validateSchema(
            bodySchema,
            ctx.body,
            "body",
          );
        }
        if (paramsSchema) {
          (ctx as any).params = await validateSchema(
            paramsSchema,
            ctx.params,
            "params",
          );
        }
        if (querySchema) {
          (ctx as any).query = await validateSchema(
            querySchema,
            ctx.query,
            "query",
          );
        }

        const result = await (instance[route.handlerName] as Function).call(
          instance,
          ctx,
        );
        // Auto-serialize return values as JSON
        if (!ctx.responseSent) {
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
      // Build middleware chain (Koa-style onion)
      let index = -1;
      const dispatch = async (i: number): Promise<void> => {
        if (i <= index) {
          throw new Error("next() called multiple times");
        }
        index = i;
        if (i === middleware.length) {
          // Run guards AFTER middleware chain, BEFORE the handler
          for (const guard of guards) {
            const allowed = await guard.canActivate(ctx);
            if (!allowed) {
              throw new ForbiddenException();
            }
          }

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

      // All filters failed — last resort
      console.error("Unhandled error (all filters failed):", error);
      try {
        if (!ctx.responseSent) {
          ctx
            .status(500)
            .json({ statusCode: 500, message: "Internal Server Error" });
        }
      } catch {
        /* response may already be sent or connection closed */
      }
    }
  };
}

async function validateSchema(
  schema: StandardSchemaV1,
  data: unknown,
  target: string,
): Promise<unknown> {
  const result = await schema["~standard"].validate(data);

  if (result.issues) {
    throw new BadRequestException(`Validation failed for ${target}`, [
      ...result.issues,
    ]);
  }

  return result.value;
}
