import { ObjectId, Collection } from "mongodb";
import { inject, Injectable } from "@decorify/di";
import { NotFoundException } from "@decorify/core";
import { MONGO_DB } from "../database.module.ts";
import type { CreateTodoDto, UpdateTodoDto, TodoDto } from "./todo.dto.ts";

@Injectable()
export class TodoService {
  private db = inject(MONGO_DB);
  private collection: Collection<any>;

  constructor() {
    this.collection = this.db.collection("todos");
  }

  async findAll(): Promise<TodoDto[]> {
    const todos = await this.collection.find({}).toArray();
    return todos.map((t) => this.mapTodo(t));
  }

  async findOne(id: string): Promise<TodoDto> {
    const todo = await this.collection.findOne({ _id: new ObjectId(id) });
    if (!todo) {
      throw new NotFoundException(`Todo with ID ${id} not found`);
    }
    return this.mapTodo(todo);
  }

  async create(dto: CreateTodoDto): Promise<TodoDto> {
    const now = new Date().toISOString();
    const newTodo = {
      ...dto,
      createdAt: now,
      updatedAt: now,
    };
    const result = await this.collection.insertOne(newTodo);
    return {
      id: result.insertedId.toString(),
      ...newTodo,
    };
  }

  async update(id: string, dto: UpdateTodoDto): Promise<TodoDto> {
    const updatedTodo = {
      ...dto,
      updatedAt: new Date().toISOString(),
    };
    const result = await this.collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updatedTodo },
      { returnDocument: "after" },
    );

    if (!result) {
      throw new NotFoundException(`Todo with ID ${id} not found`);
    }

    return this.mapTodo(result);
  }

  async delete(id: string): Promise<void> {
    const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Todo with ID ${id} not found`);
    }
  }

  private mapTodo(doc: any): TodoDto {
    const { _id, ...rest } = doc;
    return {
      id: _id.toString(),
      ...rest,
    };
  }
}
