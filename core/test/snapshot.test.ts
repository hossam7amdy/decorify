import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DecorifyApp,
  type DynamicModule,
  Inject,
  InjectionToken,
  Module,
} from "../src/index.ts";

const CONFIG = new InjectionToken<string>("CONFIG");

class Database {
  @Inject(CONFIG)
  url!: string;
}

class UserController {}

@Module({
  providers: [Database, { provide: CONFIG, useValue: "db-url" }],
  exports: [Database],
})
class DatabaseModule {}

@Module({ imports: [DatabaseModule], controllers: [UserController] })
class AppModule {}

describe("snapshot", { timeout: 1000 }, () => {
  it("serializes the whole graph, sorted by name", async () => {
    const app = await DecorifyApp.create(AppModule);
    const graph = app.snapshot();

    assert.equal(graph.root, "AppModule");
    assert.deepEqual(
      graph.modules.map((module) => module.name),
      ["AppModule", "DatabaseModule"],
    );

    const database = graph.modules[1];
    assert.equal(database?.dynamic, false);
    assert.deepEqual(database?.exports, ["Database"]);
    assert.deepEqual(
      database?.providers.map((provider) => provider.token),
      ["Database", "InjectionToken(CONFIG)"],
    );
    assert.deepEqual(database?.providers[0], {
      token: "Database",
      kind: "class",
      lifetime: "singleton",
      deps: ["InjectionToken(CONFIG)"],
    });

    const root = graph.modules[0];
    assert.deepEqual(root?.imports, ["DatabaseModule"]);
    assert.deepEqual(root?.controllers, ["UserController"]);

    await app.dispose();
  });

  it("sorts entries declared out of alphabetical order", async () => {
    class Zulu {}
    class Alpha {}
    class ZuluController {}
    class AlphaController {}

    @Module({ providers: [Zulu, Alpha], exports: [Zulu, Alpha] })
    class LeafModule {}

    @Module({
      imports: [LeafModule],
      controllers: [ZuluController, AlphaController],
    })
    class RootModule {}

    const app = await DecorifyApp.create(RootModule);
    const graph = app.snapshot();
    const leaf = graph.modules.find((module) => module.name === "LeafModule");

    assert.deepEqual(
      leaf?.providers.map((provider) => provider.token),
      ["Alpha", "Zulu"],
    );
    assert.deepEqual(leaf?.exports, ["Alpha", "Zulu"]);
    assert.deepEqual(
      graph.modules.find((module) => module.name === "RootModule")?.controllers,
      ["AlphaController", "ZuluController"],
    );

    await app.dispose();
  });

  it("names a promised dynamic root by the class it configures", async () => {
    const URL = new InjectionToken<string>("URL");

    @Module({})
    class ConfiguredModule {
      static async forRoot(url: string): Promise<DynamicModule> {
        await Promise.resolve();
        return {
          module: ConfiguredModule,
          providers: [{ provide: URL, useValue: url }],
        };
      }
    }

    const app = await DecorifyApp.create(ConfiguredModule.forRoot("db-url"));
    const graph = app.snapshot();

    assert.equal(graph.root, "ConfiguredModule");
    assert.deepEqual(
      graph.modules.map((module) => module.name),
      ["ConfiguredModule"],
    );
    assert.equal(graph.modules[0]?.dynamic, true);

    await app.dispose();
  });

  it("round-trips through JSON", async () => {
    const app = await DecorifyApp.create(AppModule);
    const graph = app.snapshot();

    assert.deepEqual(JSON.parse(JSON.stringify(graph)), graph);

    await app.dispose();
  });
});
