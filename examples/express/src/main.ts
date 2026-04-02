import { Application } from "@decorify/core";
import { ExpressAdapter } from "@decorify/express-adapter";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await Application.create(AppModule, new ExpressAdapter());

  const PORT = Number(process.env.PORT) || 3000;
  await app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

bootstrap();
