import { Module } from "@decorify/core";
import { UserController } from "./user.controller.js";
import { UserRepository } from "./user.repository.js";
import { UserService } from "./user.service.js";

@Module({
  providers: [UserService, UserRepository],
  controllers: [UserController],
})
export class UserModule {}
