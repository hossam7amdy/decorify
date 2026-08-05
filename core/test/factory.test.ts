import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DecorifyApp,
  DecorifyBootstrapError,
  DecorifyValidationError,
  Inject,
  Injectable,
  InjectionToken,
  type Injector,
  Lifetime,
  Module,
} from "../src/index.ts";

const CONFIG = new InjectionToken<string>("CONFIG");
const ABSENT = new InjectionToken<string>("ABSENT");
const NAME = new InjectionToken<string>("NAME");
const NOTHING = new InjectionToken<null>("NOTHING");
const ASYNC = new InjectionToken<Promise<string[]>>("ASYNC");

class Database {
  @Inject(CONFIG)
  url!: string;
}

class UserService {
  @Inject(Database)
  db!: Database;
}

class UserController {
  @Inject(UserService)
  service!: UserService;
}

@Module({
  providers: [{ provide: CONFIG, useValue: "db-url" }, Database],
  exports: [Database],
})
class DatabaseModule {}

@Module({
  imports: [DatabaseModule],
  providers: [UserService],
  controllers: [UserController],
})
class UserModule {}

@Module({ imports: [UserModule] })
class AppModule {}

describe("DecorifyApp", { timeout: 1000 }, () => {
  it("wires the graph into one injector", async () => {
    const app = await DecorifyApp.create(AppModule);

    const controller = app.resolve(UserController);
    assert.ok(controller instanceof UserController);
    assert.equal(controller.service.db.url, "db-url");
    assert.equal(app.resolve(UserService), controller.service);

    await app.dispose();
  });

  it("exposes controllers with their declaring module", async () => {
    const app = await DecorifyApp.create(AppModule);

    assert.deepEqual(
      app.controllers.map((entry) => [entry.ref.name, entry.module.name]),
      [["UserController", "UserModule"]],
    );

    await app.dispose();
  });

  it("exposes the graph", async () => {
    const app = await DecorifyApp.create(AppModule);

    assert.equal(app.graph.root, AppModule);
    assert.equal(app.graph.nodes.size, 3);

    await app.dispose();
  });

  it("resolves an optional missing token to null", async () => {
    const app = await DecorifyApp.create(AppModule);

    assert.equal(app.resolve(ABSENT, { optional: true }), null);

    await app.dispose();
  });

  it("resolves a factory provider's inject array into its arguments", async () => {
    class Pool {
      url: string;

      constructor(url: string) {
        this.url = url;
      }
    }

    @Module({
      imports: [DatabaseModule],
      providers: [
        {
          provide: Pool,
          useFactory: (db: Database) => new Pool(db.url),
          inject: [Database],
        },
      ],
    })
    class PoolModule {}

    const app = await DecorifyApp.create(PoolModule);

    assert.equal(app.resolve(Pool).url, "db-url");

    await app.dispose();
  });

  it("throws every validation error at once", async () => {
    class Missing {}

    class Broken {
      @Inject(Missing)
      missing!: Missing;
    }

    @Module({ providers: [Broken] })
    class BrokenModule {}

    await assert.rejects(
      () => DecorifyApp.create(BrokenModule),
      (error: unknown) => {
        assert.ok(error instanceof DecorifyValidationError);
        assert.equal(error.errors[0]?.code, "DECORIFY_E_UNKNOWN_TOKEN");
        return true;
      },
    );
  });

  it("disposes the injector on close, and close is idempotent", async () => {
    const app = await DecorifyApp.create(AppModule);

    await app.dispose();
    await app.dispose();

    assert.equal(app.injector.disposed, true);
  });

  it("surfaces a failure from disposing the injector", async () => {
    class Undisposable {
      async [Symbol.asyncDispose]() {
        throw new Error("dispose failed");
      }
    }

    @Module({ providers: [Undisposable] })
    class FailingModule {}

    const app = await DecorifyApp.create(FailingModule);

    await assert.rejects(() => app.dispose(), /dispose failed/);
  });

  it("supports await using", async () => {
    let injector: Injector | undefined;
    {
      await using app = await DecorifyApp.create(AppModule);
      injector = app.injector;
      assert.equal(injector.disposed, false);
    }
    assert.equal(injector?.disposed, true);
  });

  it("constructs every singleton at boot", async () => {
    let constructed = false;

    class Eager {
      constructor() {
        constructed = true;
      }
    }

    @Module({ providers: [Eager] })
    class EagerModule {}

    await using app = await DecorifyApp.create(EagerModule);
    assert.equal(constructed, true);
    assert.ok(app.resolve(Eager) instanceof Eager);
  });

  it("does not construct scoped or transient providers", async () => {
    let built = 0;

    @Injectable({ lifetime: Lifetime.Scoped })
    class Scoped {
      constructor() {
        built += 1;
      }
    }

    @Injectable({ lifetime: Lifetime.Transient })
    class Transient {
      constructor() {
        built += 1;
      }
    }

    @Module({ providers: [Scoped, Transient] })
    class DeferredModule {}

    await using _app = await DecorifyApp.create(DeferredModule);
    assert.equal(built, 0);
  });

  it("boots a factory that returns a primitive or null", async () => {
    @Module({
      providers: [
        { provide: NAME, useFactory: () => "decorify" },
        { provide: NOTHING, useFactory: () => null },
      ],
    })
    class PrimitiveModule {}

    await using app = await DecorifyApp.create(PrimitiveModule);
    assert.equal(app.resolve(NAME), "decorify");
    assert.equal(app.resolve(NOTHING), null);
  });

  it("rejects an async useFactory", async () => {
    @Module({
      providers: [{ provide: ASYNC, useFactory: () => Promise.resolve([]) }],
    })
    class AsyncModule {}

    await assert.rejects(
      () => DecorifyApp.create(AsyncModule),
      (error: unknown) => {
        assert.ok(error instanceof DecorifyBootstrapError);
        assert.equal(error.error.code, "DECORIFY_E_ASYNC_FACTORY");
        assert.equal(error.error.token, "InjectionToken(ASYNC)");
        return true;
      },
    );
  });
});
