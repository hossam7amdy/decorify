import { Application } from "../../dist/index.js";
import { UserController } from "./user.module/user.controller.js";
import { ExpressAdapter } from "../../dist/adapters/express/index.js";

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
