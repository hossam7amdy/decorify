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
import { TodoService } from "./todo.service.js";
import {
  CreateTodoSchema,
  UpdateTodoSchema,
  TodoParamsSchema,
} from "./todo.schema.js";

@Controller("/todos")
export class TodoController {
  private todoService = inject(TodoService);

  @Get("/")
  async getAllTodos(_ctx: HttpContext) {
    return this.todoService.findAll();
  }

  @Get("/:id")
  @ValidateParams(TodoParamsSchema)
  async getTodoById(ctx: HttpContext) {
    return this.todoService.findOne(ctx.params.id!);
  }

  @Post("/")
  @ValidateBody(CreateTodoSchema)
  async createTodo(ctx: HttpContext) {
    const newTodo = await this.todoService.create(ctx.body as any);
    ctx.status(201).json(newTodo);
  }

  @Patch("/:id")
  @ValidateParams(TodoParamsSchema)
  @ValidateBody(UpdateTodoSchema)
  async updateTodo(ctx: HttpContext) {
    return this.todoService.update(ctx.params.id!, ctx.body as any);
  }

  @Delete("/:id")
  @ValidateParams(TodoParamsSchema)
  async deleteTodo(ctx: HttpContext) {
    await this.todoService.delete(ctx.params.id!);
    ctx.status(204).send("ok");
  }
}
