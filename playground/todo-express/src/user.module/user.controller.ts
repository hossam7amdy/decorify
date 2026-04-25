import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  type HttpContext,
} from "@decorify/core";
import { inject } from "@decorify/di";
import { UserService } from "./user.service.ts";

@Controller("/users")
export class UserController {
  private userService = inject(UserService);

  @Get("/")
  async getAllUsers(_ctx: HttpContext) {
    return this.userService.findAll();
  }

  @Get("/:id")
  async getUserById(ctx: HttpContext) {
    const params = ctx.req.params;
    return this.userService.findById(params.id!);
  }

  @Post("/")
  async createUser(ctx: HttpContext) {
    const body = await ctx.req.body<any>();
    const newUser = await this.userService.create(body);
    ctx.res.status(201).json(newUser);
  }

  @Patch("/:id")
  async updateUser(ctx: HttpContext) {
    const params = ctx.req.params;
    const body = await ctx.req.body<any>();
    return this.userService.update(params.id!, body);
  }

  @Delete("/:id")
  async deleteUser(ctx: HttpContext) {
    const params = ctx.req.params;
    await this.userService.delete(params.id!);
    ctx.res.status(204).end();
  }
}
