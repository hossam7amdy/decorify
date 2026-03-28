import { inject, Injectable } from "../../../dist/di/index.js";
import type { User } from "./user.interface.js";
import { UserRepository } from "./user.repository.js";

@Injectable()
export class UserService {
  private usersRepo = inject(UserRepository);

  findAll(): User[] {
    return this.usersRepo.findAll();
  }

  findById(id: number): User | undefined {
    return this.usersRepo.findById(id);
  }

  create(data: Partial<User>): User {
    return this.usersRepo.create(data);
  }
}
