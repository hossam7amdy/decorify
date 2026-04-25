import { MongoClient, Db } from "mongodb";
import { defineModule } from "@decorify/core";
import {
  injectAsync,
  InjectionToken,
  type FactoryProvider,
} from "@decorify/di";
import { CONFIG } from "./config.module.ts";

export const MONGO_DB = new InjectionToken<Db>("MONGO_DB");

export const DatabaseProvider: FactoryProvider<Db> = {
  provide: MONGO_DB,
  useFactory: async (): Promise<Db> => {
    const config = await injectAsync(CONFIG);
    const client = new MongoClient(config.MONGODB_URI);
    await client.connect();
    console.log(`[Database] Connected successfully!`);
    return client.db();
  },
};

export const databaseModule = defineModule({
  name: "database",
  providers: [DatabaseProvider],
});
