import { ExpressAdapter } from "./index.ts";
import { runAdapterConformance } from "@decorify/core/testing";

runAdapterConformance({
  name: ExpressAdapter.name,
  makeAdapter: () => new ExpressAdapter(),
});
