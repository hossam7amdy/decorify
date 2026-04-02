import { Module } from "@decorify/core";
import { UserModule } from "./user.module/user.module.js";

@Module({
  imports: [UserModule],
})
export class AppModule {}
