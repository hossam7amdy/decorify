import { inject, Injectable } from "decorify";
import { NotFoundException } from "decorify";
import type { User } from "./user.interface.js";
import { UserRepository } from "./user.repository.js";

@Injectable()
export class UserService {
  private usersRepo = inject(UserRepository);

  findAll(): User[] {
    return this.usersRepo.findAll();
  }

  findById(id: number): User | undefined {
    const user = this.usersRepo.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  create(data: Partial<User>): User {
    return this.usersRepo.create(data);
  }
}
