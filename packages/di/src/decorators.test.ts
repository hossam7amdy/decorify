import { describe, it, expect, beforeEach } from "vitest";
import { container } from "./container.js";
import { Injectable, inject, Inject } from "./decorators.js";

describe("DI Decorators", () => {
  beforeEach(() => {
    container.clear();
  });

  it("@Injectable should register class", () => {
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
      "inject(Dep) must be called from an injection context.",
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
