import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  discover,
  Inject,
  Injectable,
  InjectionToken,
  Lifetime,
  Module,
  validate,
} from "../src/index.ts";
import { getModuleMetadata } from "../src/metadata/module.metadata.ts";

const CONFIG = new InjectionToken<string>("CONFIG");

async function codesFor(root: new () => unknown): Promise<string[]> {
  return validate(await discover(root)).map((error) => error.code);
}

describe("validate", { timeout: 1000 }, () => {
  it("accepts a well-formed graph", async () => {
    class Database {}

    class UserService {
      @Inject(Database)
      db!: Database;
    }

    class UserController {
      @Inject(UserService)
      service!: UserService;
    }

    @Module({ providers: [Database], exports: [Database] })
    class DatabaseModule {}

    @Module({
      imports: [DatabaseModule],
      providers: [UserService],
      controllers: [UserController],
    })
    class UserModule {}

    @Module({ imports: [UserModule] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), []);
  });

  it("accepts a re-exported token", async () => {
    class Database {}

    class Repo {
      @Inject(Database)
      db!: Database;
    }

    @Module({ providers: [Database], exports: [Database] })
    class DatabaseModule {}

    @Module({ imports: [DatabaseModule], exports: [Database] })
    class InfraModule {}

    @Module({ imports: [InfraModule], providers: [Repo] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), []);
  });

  it("reports a cycle alone and skips the graph checks", async () => {
    @Module({})
    class First {}

    @Module({ imports: [First] })
    class Second {}

    const meta = getModuleMetadata(First[Symbol.metadata] as DecoratorMetadata);
    assert.ok(meta);
    meta.imports = [Second];

    assert.deepEqual(await codesFor(First), ["DECORIFY_E_MODULE_CYCLE"]);
  });

  it("reports a token provided by two modules", async () => {
    class Database {}

    @Module({ providers: [Database] })
    class Left {}

    @Module({ providers: [Database] })
    class Right {}

    @Module({ imports: [Left, Right] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), ["DECORIFY_E_DUPLICATE_TOKEN"]);
  });

  it("reports a controller declared by two modules", async () => {
    class UserController {}

    @Module({ controllers: [UserController] })
    class Left {}

    @Module({ controllers: [UserController] })
    class Right {}

    @Module({ imports: [Left, Right] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), ["DECORIFY_E_DUPLICATE_TOKEN"]);
  });

  it("reports a dependency with no provider anywhere", async () => {
    class Missing {}

    class Service {
      @Inject(Missing)
      missing!: Missing;
    }

    @Module({ providers: [Service] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), ["DECORIFY_E_UNKNOWN_TOKEN"]);
  });

  it("reports a provider that exists but is not visible", async () => {
    class Database {}

    class Analytics {
      @Inject(Database)
      db!: Database;
    }

    @Module({ providers: [Database], exports: [Database] })
    class DatabaseModule {}

    @Module({ providers: [Analytics] })
    class AnalyticsModule {}

    @Module({ imports: [DatabaseModule, AnalyticsModule] })
    class AppModule {}

    const errors = validate(await discover(AppModule));

    assert.equal(errors.length, 1);
    assert.equal(errors[0]?.code, "DECORIFY_E_NOT_VISIBLE");
    assert.equal(errors[0]?.module, "AnalyticsModule");
    assert.equal(errors[0]?.token, "Database");
  });

  it("reports an unexported provider reached across modules", async () => {
    class Internal {}

    class Consumer {
      @Inject(Internal)
      internal!: Internal;
    }

    @Module({ providers: [Internal] })
    class InfraModule {}

    @Module({ imports: [InfraModule], providers: [Consumer] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), ["DECORIFY_E_NOT_VISIBLE"]);
  });

  it("reports an export the module neither provides nor imports", async () => {
    class Stranger {}

    @Module({ exports: [Stranger] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), ["DECORIFY_E_INVALID_EXPORT"]);
  });

  it("reports a controller used as a dependency", async () => {
    class UserController {}

    class Service {
      @Inject(UserController)
      controller!: UserController;
    }

    @Module({ providers: [Service], controllers: [UserController] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), [
      "DECORIFY_E_CONTROLLER_INJECTED",
    ]);
  });

  it("reports a singleton holding a scoped dependency", async () => {
    @Injectable({ lifetime: Lifetime.Scoped })
    class RequestContext {}

    class Service {
      @Inject(RequestContext)
      context!: RequestContext;
    }

    @Module({ providers: [RequestContext, Service] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), [
      "DECORIFY_E_CAPTIVE_DEPENDENCY",
    ]);
  });

  it("allows a scoped provider to hold a scoped dependency", async () => {
    @Injectable({ lifetime: Lifetime.Scoped })
    class RequestContext {}

    @Injectable({ lifetime: Lifetime.Scoped })
    class Service {
      @Inject(RequestContext)
      context!: RequestContext;
    }

    @Module({ providers: [RequestContext, Service] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), []);
  });

  it("validates factory and controller dependencies too", async () => {
    class Missing {}

    class UserController {
      @Inject(Missing)
      missing!: Missing;
    }

    @Module({
      providers: [
        { provide: CONFIG, useFactory: () => "x", inject: [Missing] },
      ],
      controllers: [UserController],
    })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), [
      "DECORIFY_E_UNKNOWN_TOKEN",
      "DECORIFY_E_UNKNOWN_TOKEN",
    ]);
  });

  it("accumulates every error rather than failing fast", async () => {
    class Missing {}
    class Stranger {}

    class Service {
      @Inject(Missing)
      missing!: Missing;
    }

    @Module({ providers: [Service], exports: [Stranger] })
    class AppModule {}

    assert.deepEqual(await codesFor(AppModule), [
      "DECORIFY_E_INVALID_EXPORT",
      "DECORIFY_E_UNKNOWN_TOKEN",
    ]);
  });

  it("returns nothing for an empty graph", () => {
    assert.deepEqual(
      validate({ root: class {}, nodes: new Map(), order: [], issues: [] }),
      [],
    );
  });

  it("treats an import absent from the graph as exporting nothing", () => {
    class Orphan {}
    class Host {}
    const node = {
      ref: Host,
      imports: [Orphan],
      providers: [],
      controllers: [],
      exports: [],
      dynamic: false,
    };

    const errors = validate({
      root: Host,
      nodes: new Map([[Host, node]]),
      order: [node],
      issues: [],
    });

    assert.deepEqual(errors, []);
  });
});
