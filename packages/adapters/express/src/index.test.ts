import { ExpressAdapter } from "./index.js";
import { runAdapterConformance } from "@decorify/core/testing";

runAdapterConformance({
  name: ExpressAdapter.name,
  makeAdapter: () => new ExpressAdapter(),
});
