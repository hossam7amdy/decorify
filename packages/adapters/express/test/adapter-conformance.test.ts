import { describe, it, expect } from "vitest";
import { ExpressAdapter } from "../src/adapter.ts";
import { runAdapterConformance } from "@decorify/core/testing";

runAdapterConformance({
  name: ExpressAdapter.name,
  makeAdapter: () => new ExpressAdapter(),
  runner: { describe, it, expect },
});
