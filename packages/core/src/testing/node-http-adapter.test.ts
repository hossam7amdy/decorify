import { runAdapterConformance } from "./index.ts";
import { NodeHttpAdapter } from "./__fixtures__/node-http-adapter.ts";

runAdapterConformance({
  name: NodeHttpAdapter.name,
  makeAdapter: () => new NodeHttpAdapter(),
});
