import { describe, it, expect } from "vitest";
import { joinPath } from "./utils.ts";

describe("joinPath", () => {
  it.each([
    ["/api", "/users", "/api/users"],
    ["api", "users", "/api/users"],
    ["/api/", "//users", "/api/users"],
    ["/api/v1", "/users/:id", "/api/v1/users/:id"],
    ["", "/users", "/users"],
    ["/api", "", "/api"],
    ["", "", "/"],
  ])('joinPath("%s", "%s") → "%s"', (base, route, expected) => {
    expect(joinPath(base, route)).toBe(expected);
  });
});
