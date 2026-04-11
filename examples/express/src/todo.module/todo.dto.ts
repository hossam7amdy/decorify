import type z from "zod";
import type {
  CreateTodoSchema,
  TodoParamsSchema,
  UpdateTodoSchema,
} from "./todo.schema.js";

export interface TodoDto {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateTodoDto = z.infer<typeof CreateTodoSchema>;

export type UpdateTodoDto = z.infer<typeof UpdateTodoSchema>;

export type TodoParamsDto = z.infer<typeof TodoParamsSchema>;
