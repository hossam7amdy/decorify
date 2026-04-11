import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  ValidateBody,
  ValidateParams,
  type HttpContext,
  inject,
} from "@decorify/core";
import { UserService } from "./user.service.js";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserParamsSchema,
} from "./user.schema.js";

@Controller("/users")
export class UserController {
  private userService = inject(UserService);

  @Get("/")
  async getAllUsers(_ctx: HttpContext) {
    return this.userService.findAll();
  }

  @Get("/:id")
  @ValidateParams(UserParamsSchema)
  async getUserById(ctx: HttpContext) {
    return this.userService.findById(ctx.params.id!);
  }

  @Post("/")
  @ValidateBody(CreateUserSchema)
  async createUser(ctx: HttpContext) {
    const newUser = await this.userService.create(ctx.body as any);
    ctx.status(201).json(newUser);
  }

  @Patch("/:id")
  @ValidateParams(UserParamsSchema)
  @ValidateBody(UpdateUserSchema)
  async updateUser(ctx: HttpContext) {
    return this.userService.update(ctx.params.id!, ctx.body as any);
  }

  @Delete("/:id")
  @ValidateParams(UserParamsSchema)
  async deleteUser(ctx: HttpContext) {
    await this.userService.delete(ctx.params.id!);
    ctx.status(204).send("ok");
  }
}
