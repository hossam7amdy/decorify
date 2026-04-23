import { describe, it, expect } from "vitest";
import { defineModule } from "./module.ts";

describe("defineModule()", () => {
  it("returns the same definition object", () => {
    const def = {
      name: "TestModule",
      providers: [],
      controllers: [],
      middlewares: [],
    };
    const result = defineModule(def);
    expect(result).toBe(def);
  });

  it("returns a definition with only the required name field", () => {
    const def = { name: "Minimal" };
    const result = defineModule(def);
    expect(result).toEqual({ name: "Minimal" });
  });
});
