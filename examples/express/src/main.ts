import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { TodoController } from "./todo.module/todo.controller.js";
import { DatabaseProvider } from "./database.provider.js";
import { config } from "./config.js";

const appExpressAdapter = new ExpressAdapter();

const app = await Application.create(appExpressAdapter, {
  controllers: [TodoController],
  globalProviders: [DatabaseProvider],
});

await app.listen(config.PORT, () => {
  console.log(`[App] Todo Application is running on port ${config.PORT}`);
  console.log(
    `[App] REST API available at http://localhost:${config.PORT}/todos`,
  );
});
