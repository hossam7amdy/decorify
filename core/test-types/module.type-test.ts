import { DecorifyApp, InjectionToken, Module } from "../src/index.ts";

const CONFIG = new InjectionToken<string>("CONFIG");

class Database {}

@Module({ providers: [Database] })
class AppModule {}

declare function expectType<T>(value: T): void;

async function main(): Promise<void> {
  const app = await DecorifyApp.create(AppModule);

  expectType<Database>(app.resolve(Database));
  expectType<string>(app.resolve(CONFIG));
  expectType<string | null>(app.resolve(CONFIG, { optional: true }));
  expectType<string>(app.snapshot().root);
  expectType<
    readonly { ref: new (...args: never[]) => unknown; module: unknown }[]
  >(app.controllers);

  // @ts-expect-error a plain object is not a module reference
  @Module({ imports: [{ nope: true }] })
  class Broken {}
  void Broken;

  // @ts-expect-error resolve() returns the token's type, not unknown
  expectType<number>(app.resolve(CONFIG));

  await app.dispose();
}

void main;
