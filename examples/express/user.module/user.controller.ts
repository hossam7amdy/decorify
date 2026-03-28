import type { HttpContext } from "../../../dist/context.js";
import { Controller, Get, Post } from "../../../dist/http/index.js";
import { Injectable, inject } from "../../../dist/di/index.js";
import { NotFoundException } from "../../../dist/errors/index.js";
import { UserService } from "./user.service.js";

@Injectable()
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
    const user = this.userService.findById(id);

    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
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
