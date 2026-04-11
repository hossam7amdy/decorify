import type { HttpAdapter } from "./adapters/http-adapter.js";
import { Container, type Constructor, type Provider } from "@decorify/di";
import type {
  MiddlewareHandler,
  GuardType,
  ExceptionFilterType,
} from "./types.js";
import { LifecycleManager } from "./lifecycle/manager.js";
import { registerControllers } from "./router.js";

interface ApplicationOptions {
  controllers: Constructor[];
  globalProviders?: Provider[];
}

export class Application<Adapter> {
  readonly adapter: HttpAdapter<Adapter>;
  private initialized = false;
  private container = new Container();
  private lifecycle = new LifecycleManager();
  private controllers: Constructor[] = [];
  private globalMiddleware: MiddlewareHandler[] = [];
  private globalGuards: GuardType[] = [];
  private globalFilters: ExceptionFilterType[] = [];

  private constructor(adapter: HttpAdapter<Adapter>) {
    this.adapter = adapter;
  }

  static async create<Adapter>(
    adapter: HttpAdapter<Adapter>,
    options: ApplicationOptions,
  ): Promise<Application<Adapter>> {
    const app = new Application(adapter);

    app.controllers = [...options.controllers];

    if (options.globalProviders) {
      options.globalProviders.forEach((provider) =>
        app.container.register(provider),
      );
    }

    return app;
  }

  resolve<T>(token: Constructor<T>): T {
    return this.container.resolve(token);
  }

  useMiddleware(...handlers: MiddlewareHandler[]): this {
    this.globalMiddleware.push(...handlers);
    return this;
  }

  useGlobalGuard(...guards: GuardType[]): this {
    this.globalGuards.push(...guards);
    return this;
  }

  useGlobalFilter(...filters: ExceptionFilterType[]): this {
    this.globalFilters.push(...filters);
    return this;
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }
    this.initialized = true;

    await this.container.initialize();

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

    for (const instance of this.container.getInstances()) {
      this.lifecycle.track(instance);
    }

    await this.lifecycle.callOnInit();
  }

  async listen(port: number, callback?: () => void): Promise<void> {
    await this.init();

    await this.adapter.listen(port, callback);
  }

  async close(): Promise<void> {
    await this.lifecycle.callOnDestroy();
    await this.container.dispose();
    await this.adapter.close();
  }
}
