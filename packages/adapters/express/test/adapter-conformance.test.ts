import { ExpressAdapter } from "../src/adapter.ts";
import { runAdapterConformance } from "@decorify/core/testing";

runAdapterConformance({
  name: ExpressAdapter.name,
  makeAdapter: () => new ExpressAdapter(),
});
