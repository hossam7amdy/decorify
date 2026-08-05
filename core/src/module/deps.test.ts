import "../../metadata-polyfill.js";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InjectionToken, Lifetime } from "injectus";

import { Inject } from "../decorators/inject.decorator.ts";
import { Injectable } from "../decorators/injectable.decorator.ts";
import type { FactoryProvider } from "../interfaces/provider.interface.ts";
import {
  getProviderDeps,
  getProviderKind,
  getProviderLifetime,
  getProviderToken,
} from "./deps.ts";

const CONFIG = new InjectionToken<string>("CONFIG");

class Database {}

class Plain {}

@Injectable({ lifetime: Lifetime.Scoped })
class ScopedService {}

class Consumer {
  @Inject(Database)
  db!: Database;

  @Inject(CONFIG)
  config!: string;
}

@Injectable({ lifetime: Lifetime.Scoped })
class BaseService {
  @Inject(Database)
  db!: Database;
}

/** Undecorated, so it shares its base's metadata object rather than shadowing it. */
class BareService extends BaseService {}

describe("provider introspection", {
  timeout: 1000,
  concurrency: true,
}, () => {
  it("reads a class shorthand", () => {
    assert.equal(getProviderKind(Consumer), "class");
    assert.equal(getProviderToken(Consumer), Consumer);
    assert.deepEqual(getProviderDeps(Consumer), [Database, CONFIG]);
    assert.equal(getProviderLifetime(Consumer), Lifetime.Singleton);
  });

  it("reads a lifetime from @Injectable", () => {
    assert.equal(getProviderLifetime(ScopedService), Lifetime.Scoped);
  });

  it("reports no dependencies for an undecorated class", () => {
    assert.deepEqual(getProviderDeps(Plain), []);
  });

  it("reads a base's metadata through an undecorated subclass", () => {
    assert.deepEqual(getProviderDeps(BareService), [Database]);
    assert.equal(getProviderLifetime(BareService), Lifetime.Scoped);
  });

  it("reads a value provider", () => {
    const provider = { provide: CONFIG, useValue: "db-url" };

    assert.equal(getProviderKind(provider), "value");
    assert.equal(getProviderToken(provider), CONFIG);
    assert.deepEqual(getProviderDeps(provider), []);
    assert.equal(getProviderLifetime(provider), Lifetime.Singleton);
  });

  it("reads a class provider through useClass", () => {
    const provider = {
      provide: Database,
      useClass: Consumer,
      lifetime: Lifetime.Transient,
    };

    assert.equal(getProviderKind(provider), "class");
    assert.deepEqual(getProviderDeps(provider), [Database, CONFIG]);
    assert.equal(getProviderLifetime(provider), Lifetime.Transient);
  });

  it("defaults a class provider without a lifetime to singleton", () => {
    const provider = { provide: Database, useClass: Plain };

    assert.equal(getProviderLifetime(provider), Lifetime.Singleton);
  });

  it("reads a factory provider's inject array", () => {
    const provider: FactoryProvider<string> = {
      provide: CONFIG,
      useFactory: (value: string) => value,
      inject: [Database],
    };

    assert.equal(getProviderKind(provider), "factory");
    assert.deepEqual(getProviderDeps(provider), [Database]);
  });

  it("treats a factory without inject as dependency-free", () => {
    const provider: FactoryProvider<string> = {
      provide: CONFIG,
      useFactory: () => "x",
    };

    assert.deepEqual(getProviderDeps(provider), []);
  });

  it("reads an existing provider's target as its dependency", () => {
    const provider = { provide: CONFIG, useExisting: Database };

    assert.equal(getProviderKind(provider), "existing");
    assert.deepEqual(getProviderDeps(provider), [Database]);
    assert.equal(getProviderLifetime(provider), Lifetime.Singleton);
  });
});
