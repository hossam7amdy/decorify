import { describe, it, expect, beforeEach } from "vitest";
import { Container } from "./container.js";
import { Injectable, Inject, inject } from "./decorators.js";

describe("DI Decorators", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  it("@Injectable should auto-register class on resolve", () => {
    @Injectable()
    class MyService {}

    container.register(MyService);
    const instance = container.resolve(MyService);
    expect(instance).toBeInstanceOf(MyService);
  });

  it("@Injectable should enable auto-registration without explicit register()", () => {
    @Injectable()
    class MyService {}

    const instance = container.resolve(MyService);
    expect(instance).toBeInstanceOf(MyService);
  });

  it("inject() should resolve dependency during construction", () => {
    @Injectable()
    class Dep {}

    @Injectable()
    class MyService {
      dep = inject(Dep);
    }

    const service = container.resolve(MyService);
    expect(service.dep).toBeInstanceOf(Dep);
  });

  it("inject() should throw if called outside injection context", () => {
    class Dep {}
    expect(() => inject(Dep)).toThrow(
      "inject() called outside of an injection context",
    );
  });

  it("@Inject should resolve dependency as field initializer", () => {
    @Injectable()
    class Dep {}

    class MyService {
      @Inject(Dep) dep!: Dep;
    }

    container.register(MyService);
    const service = container.resolve(MyService);
    expect(service.dep).toBeInstanceOf(Dep);
  });
});
