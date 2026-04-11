import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { TodoController } from "./todo.module/todo.controller.js";
import { UserController } from "./user.module/user.controller.js";
import { DatabaseProvider } from "./database.provider.js";
import { ConfigProvider } from "./config.provider.js";

export async function bootstrap() {
  const adapter = new ExpressAdapter();
  const app = await Application.create(adapter, {
    controllers: [TodoController, UserController],
    globalProviders: [ConfigProvider, DatabaseProvider],
  });

  return { app, adapter };
}
