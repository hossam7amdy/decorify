import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DecorifyBootstrapError, DecorifyValidationError } from "./errors.ts";

describe("errors", { timeout: 1000, concurrency: true }, () => {
  it("renders every error with its code and module", () => {
    const error = new DecorifyValidationError([
      {
        code: "DECORIFY_E_NOT_VISIBLE",
        module: "AnalyticsModule",
        token: "Database",
        message: "Analytics depends on Database.",
      },
      { code: "DECORIFY_E_UNKNOWN_TOKEN", message: "No provider for Cache." },
    ]);

    assert.equal(error.name, "DecorifyValidationError");
    assert.equal(error.errors.length, 2);
    assert.match(error.message, /2 error\(s\)/);
    assert.match(error.message, /DECORIFY_E_NOT_VISIBLE \[AnalyticsModule\]/);
    assert.match(error.message, /Analytics depends on Database\./);
    assert.match(error.message, /DECORIFY_E_UNKNOWN_TOKEN\n/);
    assert.ok(error instanceof Error);
  });

  it("reports a single count for one error", () => {
    const error = new DecorifyValidationError([
      { code: "DECORIFY_E_MODULE_CYCLE", message: "A -> B -> A" },
    ]);

    assert.match(error.message, /1 error\(s\)/);
  });

  it("wraps a single bootstrap issue", () => {
    const error = new DecorifyBootstrapError({
      code: "DECORIFY_E_ASYNC_FACTORY",
      token: "Pool",
      message: "Pool resolved to a Promise.",
    });

    assert.equal(error.name, "DecorifyBootstrapError");
    assert.equal(error.error.token, "Pool");
    assert.equal(
      error.message,
      "DECORIFY_E_ASYNC_FACTORY Pool resolved to a Promise.",
    );
  });
});
