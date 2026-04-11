import { z } from "zod";

export const CreateUserSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters long"),
  email: z.string().email("Invalid email address"),
});

export const UpdateUserSchema = CreateUserSchema.partial();

export const UserParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid User ID"),
});
