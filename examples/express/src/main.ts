import { bootstrap } from "./app.js";
import { CONFIG } from "./config.provider.js";

const { app } = await bootstrap();

const config = app.resolve(CONFIG);
await app.listen(config.PORT, () => {
  console.log(`[App] Todo Application is running on port ${config.PORT}`);
});
