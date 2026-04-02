import type { HttpContext } from "@decorify/core";
import { Controller, Get, Post } from "@decorify/core";
import { inject } from "@decorify/core";
import { UserService } from "./user.service.js";

@Controller("/users")
export class UserController {
  private userService = inject(UserService);

  @Get("/")
  async getAllUsers(_ctx: HttpContext) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return this.userService.findAll();
  }

  @Get("/:id")
  async getUserById(ctx: HttpContext) {
    const id = parseInt(ctx.params.id!, 10);
    return this.userService.findById(id);
  }

  @Post("/")
  async createUser(ctx: HttpContext) {
    const newUser = this.userService.create(ctx.body as any);
    ctx.status(201).json(newUser);
  }

  @Get("/error")
  async triggerError(_ctx: HttpContext) {
    throw new Error("Simulated database failure.");
  }
}
