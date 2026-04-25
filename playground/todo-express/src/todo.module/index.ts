import { defineModule } from "@decorify/core";
import { TodoController } from "./todo.controller.ts";
import { TodoService } from "./todo.service.ts";

export const todoModule = defineModule({
  name: "todo",
  providers: [TodoService],
  controllers: [TodoController],
});
