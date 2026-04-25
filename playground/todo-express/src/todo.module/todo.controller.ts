import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  type HttpContext,
} from "@decorify/core";
import { inject } from "@decorify/di";
import { TodoService } from "./todo.service.ts";

@Controller("/todos")
export class TodoController {
  private todoService = inject(TodoService);

  @Get("/")
  async getAllTodos(_ctx: HttpContext) {
    return this.todoService.findAll();
  }

  @Get("/:id")
  async getTodoById(ctx: HttpContext) {
    return this.todoService.findOne(ctx.req.params.id!);
  }

  @Post("/")
  async createTodo(ctx: HttpContext) {
    const body = await ctx.req.body<any>();
    const newTodo = await this.todoService.create(body);
    ctx.res.status(201).json(newTodo);
  }

  @Patch("/:id")
  async updateTodo(ctx: HttpContext) {
    const params = ctx.req.params;
    const body = await ctx.req.body<any>();
    return this.todoService.update(params.id!, body);
  }

  @Delete("/:id")
  async deleteTodo(ctx: HttpContext) {
    await this.todoService.delete(ctx.req.params.id!);
    ctx.res.status(204).end();
  }
}
