import { z } from "zod";

export const CreateTodoSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  completed: z.boolean().default(false),
});

export const UpdateTodoSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  completed: z.boolean().optional(),
});

export const TodoParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Todo ID"),
});
