import type z from "zod";
import type {
  CreateUserSchema,
  UpdateUserSchema,
  UserParamsSchema,
} from "./user.schema.ts";

export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export type UserParamsDto = z.infer<typeof UserParamsSchema>;
