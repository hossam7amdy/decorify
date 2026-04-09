import type { HttpAdapter } from "./adapters/http-adapter.js";
import { Container, type Constructor, type Provider } from "@decorify/di";
import type { MiddlewareHandler, Guard, ExceptionFilter } from "./types.js";
import { LifecycleManager } from "./lifecycle/manager.js";
import { registerControllers } from "./router.js";

export class Application {
  private container = new Container();
  private lifecycle = new LifecycleManager();
  private controllers: Constructor[] = [];
  private globalMiddleware: MiddlewareHandler[] = [];
  private globalGuards: Guard[] = [];
  private globalFilters: ExceptionFilter[] = [];

  protected constructor(private adapter: HttpAdapter) {}

  static async create(
    controllers: Constructor[],
    adapter: HttpAdapter,
  ): Promise<Application> {
    const app = new Application(adapter);

    // Defensive copy to avoid external mutations
    app.controllers = [...controllers];

    // Register all controllers and build route pipelines
    registerControllers(
      app.container,
      app.adapter,
      app.controllers,
      app.lifecycle,
      {
        globalMiddleware: app.globalMiddleware,
        globalGuards: app.globalGuards,
        globalFilters: app.globalFilters,
      },
    );

    return app;
  }

  resolve<T>(token: Constructor<T>): T {
    return this.container.resolve(token);
  }

  register<T>(...providers: Provider<T>[]): this {
    providers.forEach((provider) => this.container.register(provider));
    return this;
  }

  useMiddleware(...handlers: MiddlewareHandler[]): this {
    this.globalMiddleware.push(...handlers);
    return this;
  }

  useGlobalGuard(...guards: Guard[]): this {
    this.globalGuards.push(...guards);
    return this;
  }

  useGlobalFilter(...filters: ExceptionFilter[]): this {
    this.globalFilters.push(...filters);
    return this;
  }

  async listen(port: number, callback?: () => void): Promise<void> {
    await this.lifecycle.callOnInit();

    await this.adapter.listen(port, callback);
  }

  async close(): Promise<void> {
    await this.lifecycle.callOnDestroy();
    await this.adapter.close();
  }

  /** Access the underlying HTTP framework instance (escape hatch) */
  getAdapter(): HttpAdapter {
    return this.adapter;
  }
}
