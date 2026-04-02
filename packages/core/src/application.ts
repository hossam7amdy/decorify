import type { HttpAdapter } from "./adapters/http-adapter.js";
import { Container, type Constructor } from "@decorify/di";
import type { MiddlewareHandler, Guard, ExceptionFilter } from "./types.js";
import { LifecycleManager } from "./lifecycle/manager.js";
import { registerControllers } from "./router.js";
import { processModules } from "./module/processor.js";

export class Application {
  private container = new Container();
  private lifecycle = new LifecycleManager();
  private controllers: Constructor[] = [];
  private globalMiddleware: MiddlewareHandler[] = [];
  private globalGuards: Guard[] = [];
  private globalFilters: ExceptionFilter[] = [];

  private constructor(private adapter: HttpAdapter) {}

  static async create(
    rootModule: Constructor,
    adapter: HttpAdapter,
  ): Promise<Application> {
    const app = new Application(adapter);
    app.controllers = processModules(app.container, rootModule);
    return app;
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
    registerControllers(
      this.container,
      this.adapter,
      this.controllers,
      this.lifecycle,
      {
        globalMiddleware: this.globalMiddleware,
        globalGuards: this.globalGuards,
        globalFilters: this.globalFilters,
      },
    );

    await this.lifecycle.callOnInit();
    await this.adapter.listen(port, callback);
  }

  async close(): Promise<void> {
    await this.lifecycle.callOnDestroy();
    await this.adapter.close();
  }

  getAdapter(): HttpAdapter {
    return this.adapter;
  }
}
