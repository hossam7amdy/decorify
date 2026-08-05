import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  type DynamicModule,
  discover,
  Inject,
  InjectionToken,
  Module,
} from "../src/index.ts";
import { getModuleMetadata } from "../src/metadata/module.metadata.ts";

const CONFIG = new InjectionToken<string>("CONFIG");
const OTHER = new InjectionToken<string>("OTHER");

class Database {}
class UserService {}
class UserController {}
class Extra {}
class ExtraController {}

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

@Module({ providers: [Database] })
class ConfigModule {
  static configure(value: string): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: CONFIG, useValue: value }],
    };
  }

  static async configureAsync(): Promise<DynamicModule> {
    return {
      module: ConfigModule,
      providers: [{ provide: CONFIG, useValue: "async" }],
    };
  }

  static configureOther(): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: OTHER, useValue: "other" }],
    };
  }
}

// Every metadata field populated on BOTH sides, so `merge` exercises its
// non-nullish branches. ConfigModule above covers the nullish ones.
@Module({
  imports: [DatabaseModule],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService],
})
class FullModule {
  static configure(): DynamicModule {
    return {
      module: FullModule,
      imports: [UserModule],
      providers: [Extra],
      controllers: [ExtraController],
      exports: [Extra],
    };
  }
}

// Neither side declares providers, so `merge` exercises the one pair of
// nullish branches the modules above never reach.
@Module({ imports: [DatabaseModule] })
class ProviderlessModule {
  static configure(): DynamicModule {
    return { module: ProviderlessModule, controllers: [ExtraController] };
  }
}

describe("discover", { timeout: 1000 }, () => {
  it("walks the whole graph from the root", async () => {
    const graph = await discover(AppModule);

    assert.equal(graph.root, AppModule);
    assert.equal(graph.nodes.size, 3);
    assert.deepEqual(
      graph.order.map((node) => node.ref),
      [DatabaseModule, UserModule, AppModule],
    );
    assert.deepEqual(graph.issues, []);
  });

  it("records providers, controllers and exports", async () => {
    const graph = await discover(AppModule);
    const user = graph.nodes.get(UserModule);

    assert.deepEqual(user?.providers, [UserService]);
    assert.deepEqual(user?.controllers, [UserController]);
    assert.deepEqual(user?.imports, [DatabaseModule]);
    assert.equal(user?.dynamic, false);
    assert.deepEqual(graph.nodes.get(DatabaseModule)?.exports, [Database]);
  });

  it("defaults every field for a module with no metadata at all", async () => {
    class Bare {}
    const graph = await discover(Bare);
    const node = graph.nodes.get(Bare);

    assert.deepEqual(node?.providers, []);
    assert.deepEqual(node?.controllers, []);
    assert.deepEqual(node?.exports, []);
    assert.deepEqual(node?.imports, []);
  });

  it("defaults every field for a class carrying non-module metadata", async () => {
    class Decorated {
      @Inject(Database)
      db!: Database;
    }

    const graph = await discover(Decorated);

    assert.deepEqual(graph.nodes.get(Decorated)?.providers, []);
  });

  it("concatenates every metadata field, static first", async () => {
    @Module({ imports: [FullModule.configure()] })
    class Root {}

    const graph = await discover(Root);
    const node = graph.nodes.get(FullModule);

    assert.deepEqual(node?.imports, [DatabaseModule, UserModule]);
    assert.deepEqual(node?.providers, [UserService, Extra]);
    assert.deepEqual(node?.controllers, [UserController, ExtraController]);
    assert.deepEqual(node?.exports, [UserService, Extra]);
  });

  it("concatenates dynamic metadata onto the class's static metadata", async () => {
    @Module({ imports: [ConfigModule.configure("db-url")] })
    class Root {}

    const graph = await discover(Root);
    const node = graph.nodes.get(ConfigModule);

    assert.equal(node?.dynamic, true);
    assert.equal(node?.providers.length, 2);
    assert.equal(node?.providers[0], Database);
  });

  it("merges a dynamic module that declares no providers on either side", async () => {
    @Module({ imports: [ProviderlessModule.configure()] })
    class Root {}

    const graph = await discover(Root);
    const node = graph.nodes.get(ProviderlessModule);

    assert.deepEqual(node?.providers, []);
    assert.deepEqual(node?.controllers, [ExtraController]);
    assert.deepEqual(node?.imports, [DatabaseModule]);
  });

  it("awaits a promised dynamic module", async () => {
    @Module({ imports: [ConfigModule.configureAsync()] })
    class Root {}

    const graph = await discover(Root);

    assert.equal(graph.nodes.get(ConfigModule)?.dynamic, true);
  });

  it("dedupes a module imported by two others", async () => {
    @Module({ imports: [DatabaseModule] })
    class Left {}

    @Module({ imports: [DatabaseModule] })
    class Right {}

    @Module({ imports: [Left, Right] })
    class Root {}

    const graph = await discover(Root);

    assert.equal(graph.nodes.size, 4);
    assert.deepEqual(graph.issues, []);
  });

  it("dedupes a dynamic module configured identically twice", async () => {
    @Module({ imports: [ConfigModule.configure("db-url")] })
    class Left {}

    @Module({ imports: [ConfigModule.configure("db-url")] })
    class Right {}

    @Module({ imports: [Left, Right] })
    class Root {}

    const graph = await discover(Root);

    assert.deepEqual(graph.issues, []);
  });

  it("reports a conflict when the same module yields different tokens", async () => {
    @Module({ imports: [ConfigModule.configure("db-url")] })
    class Left {}

    @Module({ imports: [ConfigModule.configureOther()] })
    class Right {}

    @Module({ imports: [Left, Right] })
    class Root {}

    const graph = await discover(Root);

    assert.equal(graph.issues.length, 1);
    assert.equal(graph.issues[0]?.code, "DECORIFY_E_DYNAMIC_CONFLICT");
    assert.equal(graph.issues[0]?.module, "ConfigModule");
  });

  it("reports a conflict when two configurations differ in size", async () => {
    @Module({ imports: [FullModule.configure()] })
    class Left {}

    // A `DynamicModule` literal that adds nothing: still a configuration, but
    // a smaller one than `configure()` returns.
    @Module({ imports: [{ module: FullModule }] })
    class Right {}

    @Module({ imports: [Left, Right] })
    class Root {}

    const graph = await discover(Root);

    assert.equal(graph.issues.length, 1);
    assert.equal(graph.issues[0]?.code, "DECORIFY_E_DYNAMIC_CONFLICT");
  });

  it("treats a bare re-import of a configured module as an edge", async () => {
    @Module({ imports: [ConfigModule.configure("db-url")] })
    class Left {}

    @Module({ imports: [ConfigModule] })
    class Right {}

    @Module({ imports: [Left, Right] })
    class Root {}

    const graph = await discover(Root);
    const node = graph.nodes.get(ConfigModule);

    assert.deepEqual(graph.issues, []);
    assert.equal(node?.dynamic, true);
    assert.equal(node?.providers.length, 2);
  });

  it("lets a configuration replace a bare import discovered first", async () => {
    @Module({ imports: [FullModule] })
    class Left {}

    @Module({ imports: [FullModule.configure()] })
    class Right {}

    @Module({ imports: [Left, Right] })
    class Root {}

    const graph = await discover(Root);
    const node = graph.nodes.get(FullModule);

    assert.deepEqual(graph.issues, []);
    assert.equal(node?.dynamic, true);
    // The configuration's own imports are discovered even though the bare
    // edge was walked first.
    assert.deepEqual(node?.imports, [DatabaseModule, UserModule]);
    assert.equal(graph.nodes.has(UserModule), true);
  });

  it("reports a cycle and produces no order", async () => {
    @Module({})
    class First {}

    @Module({ imports: [First] })
    class Second {}

    // Close the loop after both classes exist.
    const meta = getModuleMetadata(First[Symbol.metadata] as DecoratorMetadata);
    assert.ok(meta);
    meta.imports = [Second];

    const graph = await discover(First);

    assert.deepEqual(graph.order, []);
    assert.equal(graph.issues[0]?.code, "DECORIFY_E_MODULE_CYCLE");
    assert.deepEqual(graph.issues[0]?.path, ["First", "Second", "First"]);
  });
});
