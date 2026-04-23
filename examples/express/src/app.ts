import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { databaseModule } from "./database.module.ts";
import { configModule } from "./config.module.ts";
import { todoModule } from "./todo.module/index.ts";
import { userModule } from "./user.module/index.ts";

export async function bootstrap() {
  const app = await Application.create({
    adapter: new ExpressAdapter(),
    modules: [databaseModule, configModule, todoModule, userModule],
  });

  return app;
}
