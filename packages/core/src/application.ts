import { Container, type Constructor, type Token } from "@decorify/di";
import type { Handler, HttpAdapter, HttpMethod } from "./http/adapter.ts";
import type { ModuleDefinition } from "./module.ts";
import { compose, type Middleware } from "./middleware.ts";
import {
  ROUTE_MIDDLEWARE,
  CONTROLLER_MIDDLEWARE,
  type RouteMiddlewareMap,
} from "./decorators/middleware.ts";
import { ROUTE_META, type RouteMeta } from "./decorators/route.ts";
import {
  defaultErrorHandler,
  type ErrorHandler,
} from "./errors/error-handler.ts";
import {
  CONTROLLER_META,
  type ControllerMeta,
} from "./decorators/controller.ts";

interface RegisteredRoute {
  method: HttpMethod;
  path: string;
  controller: string;
}

export interface ApplicationOptions {
  readonly adapter: HttpAdapter;
  readonly container?: Container;
  readonly modules: readonly ModuleDefinition[];
  readonly globalMiddleware?: readonly Middleware[];
  readonly errorHandler?: ErrorHandler;
}

export class Application {
  private readonly adapter: HttpAdapter;
  private readonly container: Container;
  private readonly routes: RegisteredRoute[];

  private constructor(
    adapter: HttpAdapter,
    container: Container = new Container(),
  ) {
    this.container = container;
    this.adapter = adapter;
    this.routes = [];
  }

  static async create(opts: ApplicationOptions): Promise<Application> {
    const app = new Application(opts.adapter, opts.container);

    const globalMiddlewares = opts.globalMiddleware ?? [];

    // Phase 1: register all providers across all modules
    for (const mod of opts.modules) {
      for (const provider of mod.providers ?? []) {
        app.container.register(provider);
      }
    }

    // Phase 2: register controllers (providers must be available first)
    for (const mod of opts.modules) {
      const moduleMiddlewares = [
        ...globalMiddlewares,
        ...(mod.middlewares ?? []),
      ];
      for (const Ctrl of mod.controllers ?? []) {
        app.registerController(Ctrl, moduleMiddlewares, opts.errorHandler);
      }
    }

    await app.container.initialize();

    return app;
  }

  resolve<T>(token: Token<T>): T {
    return this.container.resolve(token);
  }

  private registerController(
    ControllerClass: Constructor,
    moduleMiddlewares: readonly Middleware[],
    errorHandler = defaultErrorHandler,
  ): void {
    const metadata = (ControllerClass as any)[Symbol.metadata];
    if (!metadata) {
      console.warn(
        `Class ${ControllerClass.name} has no metadata. Did you forget @Controller?`,
      );
      return;
    }

    const ctrlMiddlewares: readonly Middleware[] =
      metadata[CONTROLLER_MIDDLEWARE] ?? [];
    const routes: readonly RouteMeta[] = metadata[ROUTE_META] ?? [];
    const routeMiddlewareMap: RouteMiddlewareMap =
      metadata[ROUTE_MIDDLEWARE] ?? new Map();
    const controllerMeta: ControllerMeta = metadata[CONTROLLER_META] ?? {};

    const prefix = controllerMeta.prefix ?? "";
    for (const route of routes) {
      const fullPath = joinPath(prefix, route.path);
      const routeMiddlewares = routeMiddlewareMap.get(route.propertyKey) ?? [];
      const chain = [
        ...moduleMiddlewares,
        ...ctrlMiddlewares,
        ...routeMiddlewares,
      ];
      const runChain = compose(chain);

      const handler: Handler = async (ctx) => {
        const instance =
          this.container.resolve<Record<string | symbol, Handler>>(
            ControllerClass,
          );
        const method = instance[route.propertyKey]?.bind(instance);
        if (typeof method !== "function") {
          throw new Error(
            `Method ${String(route.propertyKey)} not found on ${ControllerClass.name}`,
          );
        }
        return method(ctx);
      };

      const routeHandler: Handler = async (ctx) => {
        try {
          const result = await runChain(ctx, handler);
          if (ctx.res.sent) {
            if (process.env.NODE_ENV !== "production" && result !== undefined) {
              console.warn(
                `[${Application.name}] handler for ${ctx.req.method} ${ctx.req.path} sent a response AND returned a value; return value ignored`,
              );
            }
            return;
          }
          if (result !== undefined) {
            await ctx.res.json(result);
            return;
          }
          await ctx.res.status(204).end();
        } catch (err) {
          await errorHandler(err, ctx);
        }
      };

      this.routes.push({
        method: route.method,
        path: fullPath,
        controller: ControllerClass.name,
      });

      this.adapter.registerRoute({
        method: route.method,
        path: fullPath,
        handler: routeHandler,
      });
    }
  }

  async listen(port: number, host?: string): Promise<void> {
    await this.adapter.listen(port, host);
  }

  async close(): Promise<void> {
    await this.adapter.close();
    await this.container.dispose();
  }

  getAdapter<TAdapter extends HttpAdapter>(): Readonly<TAdapter> {
    return this.adapter as TAdapter;
  }

  getRoutes(): readonly RegisteredRoute[] {
    return this.routes;
  }
}

function joinPath(a: string, b: string): string {
  const left = a.replace(/\/+$/, "");
  const right = b.startsWith("/") ? b : `/${b}`;
  return (left + right).toString() || "/";
}
