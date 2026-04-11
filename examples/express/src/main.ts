import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { TodoController } from "./todo.module/todo.controller.js";
import { DatabaseProvider } from "./database.provider.js";
import { CONFIG, ConfigProvider } from "./config.provider.ts";

const appExpressAdapter = new ExpressAdapter();

const app = await Application.create(appExpressAdapter, {
  controllers: [TodoController],
  globalProviders: [ConfigProvider, DatabaseProvider],
});

const config = app.resolve(CONFIG);
await app.listen(config.PORT, () => {
  console.log(`[App] Todo Application is running on port ${config.PORT}`);
});
