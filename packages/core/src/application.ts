import type { HttpAdapter } from "./adapters/http-adapter.js";
import { Container, type Constructor } from "@decorify/di";
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

  constructor(private adapter: HttpAdapter) {}

  register(controllers: Constructor[]): this {
    this.controllers.push(...controllers);
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
    // Register all controllers and build route pipelines
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

    // Call onInit() on all tracked instances
    await this.lifecycle.callOnInit();

    // Start listening
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
