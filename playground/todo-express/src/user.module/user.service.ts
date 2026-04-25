import { ObjectId, Collection } from "mongodb";
import { inject, Injectable } from "@decorify/di";
import { NotFoundException } from "@decorify/core";
import { MONGO_DB } from "../database.module.ts";
import type { CreateUserDto, UpdateUserDto, UserDto } from "./user.dto.ts";

@Injectable()
export class UserService {
  private db = inject(MONGO_DB);
  private collection: Collection;

  constructor() {
    this.collection = this.db.collection("users");
  }

  async findAll(): Promise<UserDto[]> {
    const users = await this.collection.find({}).toArray();
    return users.map((u) => this.mapUser(u));
  }

  async findById(id: string): Promise<UserDto> {
    const user = await this.collection.findOne({ _id: new ObjectId(id) });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return this.mapUser(user);
  }

  async create(dto: CreateUserDto): Promise<UserDto> {
    const now = new Date().toISOString();
    const newUser = {
      ...dto,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(newUser);
    return {
      id: result.insertedId.toString(),
      ...newUser,
    };
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDto> {
    const updatedUser = {
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updatedUser },
      { returnDocument: "after" },
    );

    if (!result) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.mapUser(result);
  }

  async delete(id: string): Promise<void> {
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  private mapUser(doc: any): UserDto {
    const { _id, ...rest } = doc;
    return {
      id: _id.toString(),
      ...rest,
    };
  }
}
