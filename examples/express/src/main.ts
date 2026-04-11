import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { UserController } from "./user.module/user.controller.js";

async function bootstrap() {
  const appExpressAdapter = new ExpressAdapter();
  const app = await Application.create(appExpressAdapter, {
    controllers: [UserController],
  });

  const PORT = Number(process.env.PORT) || 3000;
  await app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

bootstrap();
