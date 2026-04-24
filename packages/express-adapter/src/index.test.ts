import type { AddressInfo } from "node:net";
import { ExpressAdapter } from "./index.ts";
import { runAdapterConformance } from "@decorify/core/testing";

runAdapterConformance({
  name: "ExpressAdapter",
  makeAdapter: () => new ExpressAdapter(),
  getBaseUrl: (adapter) => {
    const { port } = adapter.server!.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  },
});
