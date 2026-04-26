import { describe, it, expect } from "vitest";
import { FastifyAdapter } from "../src/adapter.ts";
import { runAdapterConformance } from "@decorify/testing";

runAdapterConformance({
  name: FastifyAdapter.name,
  makeAdapter: () => new FastifyAdapter(),
  runner: { describe, it, expect },
});
