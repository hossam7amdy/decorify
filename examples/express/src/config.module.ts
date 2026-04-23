import { z } from "zod/v4";
import { configDotenv } from "dotenv";
import {
  defineModule,
  InjectionToken,
  type FactoryProvider,
} from "@decorify/core";

const configSchema = z.object({
  PORT: z.coerce.number().int().default(3000),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/todo-app"),
});

export type Config = z.infer<typeof configSchema>;

export const CONFIG = new InjectionToken<Config>("CONFIG");

export const ConfigProvider: FactoryProvider<Config> = {
  provide: CONFIG,
  useFactory: () => {
    configDotenv();
    return configSchema.parseAsync(process.env);
  },
};

export const configModule = defineModule({
  name: "configuration",
  providers: [ConfigProvider],
});
