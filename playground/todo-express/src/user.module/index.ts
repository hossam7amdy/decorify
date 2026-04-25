import { defineModule } from "@decorify/core";
import { UserController } from "./user.controller.ts";
import { UserRepository } from "./user.repository.ts";
import { UserService } from "./user.service.ts";

export const userModule = defineModule({
  name: "user",
  providers: [UserRepository, UserService],
  controllers: [UserController],
});
