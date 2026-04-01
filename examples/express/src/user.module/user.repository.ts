import { Injectable } from "@decorify/core";
import type { User } from "./user.interface.js";

@Injectable()
export class UserRepository {
  private users: User[] = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];

  findAll(): User[] {
    return this.users;
  }

  findById(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  create(data: Partial<User>): User {
    const newUser = { id: this.users.length + 1, ...data } as User;
    this.users.push(newUser);
    return newUser;
  }
}
