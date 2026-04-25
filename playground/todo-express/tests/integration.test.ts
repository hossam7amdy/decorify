import { ExpressAdapter } from "@decorify/express";
import { Application } from "@decorify/core";
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { Collection, Db } from "mongodb";
import request from "supertest";
import { bootstrap } from "../src/app.js";
import { MONGO_DB } from "../src/database.module.js";

describe("Integration Tests", () => {
  let app: Application;
  let adapter: ExpressAdapter;
  let db: Db;
  let todoCollection: Collection;
  let userCollection: Collection;

  beforeAll(async () => {
    app = await bootstrap();
    adapter = app.getAdapter() as ExpressAdapter;

    db = app.resolve(MONGO_DB);
    todoCollection = db.collection("todos");
    userCollection = db.collection("users");
  });

  beforeEach(async () => {
    await todoCollection.deleteMany({});
    await userCollection.deleteMany({});
  });

  describe("Todos API", () => {
    it("should create a new todo", async () => {
      const resp = await request(adapter.native)
        .post("/todos")
        .send({ title: "Test Todo" });

      expect(resp.status).toBe(201);
      expect(resp.body.title).toBe("Test Todo");
      expect(resp.body.id).toBeDefined();
    });

    it("should get all todos", async () => {
      await todoCollection.insertOne({
        title: "Existing Todo",
        completed: false,
        createdAt: new Date().toISOString(),
      });

      const resp = await request(adapter.native).get("/todos");

      expect(resp.status).toBe(200);
      expect(resp.body).toHaveLength(1);
      expect(resp.body[0].title).toBe("Existing Todo");
    });
  });

  describe("Users API", () => {
    it("should create a new user", async () => {
      const resp = await request(adapter.native)
        .post("/users")
        .send({ name: "Alice", email: "alice@example.com" });

      expect(resp.status).toBe(201);
      expect(resp.body.name).toBe("Alice");
    });
  });
});
