import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { UserController } from "./user.module/user.controller.js";

async function bootstrap() {
  const expressApp = new ExpressAdapter();
  const app = new Application(expressApp);

  app.register([UserController]);

  const PORT = Number(process.env.PORT) || 3000;
  await app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

bootstrap();
