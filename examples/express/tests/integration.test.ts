import { ExpressAdapter } from "@decorify/express-adapter";
import { Application } from "@decorify/core";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { Collection, Db } from "mongodb";
import request from "supertest";
import { bootstrap } from "../src/app.js";
import { MONGO_DB } from "../src/database.provider.js";

describe("Integration Tests", () => {
  let app: Application<any>;
  let adapter: ExpressAdapter;
  let db: Db;
  let todoCollection: Collection;
  let userCollection: Collection;

  beforeAll(async () => {
    const result = await bootstrap();

    app = result.app;
    adapter = result.adapter;

    db = app.resolve(MONGO_DB);
    todoCollection = db.collection("todos");
    userCollection = db.collection("users");

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await todoCollection.deleteMany({});
    await userCollection.deleteMany({});
  });

  describe("Todos API", () => {
    it("should create a new todo", async () => {
      const resp = await request(adapter.getInstance())
        .post("/todos")
        .send({ title: "Test Todo" });

      expect(resp.status).toBe(201);
      expect(resp.body.title).toBe("Test Todo");
      expect(resp.body.id).toBeDefined();
    });

    it("should return 400 for invalid todo body", async () => {
      const resp = await request(adapter.getInstance())
        .post("/todos")
        .send({ title: "" }); // too short

      expect(resp.status).toBe(400);
      expect(resp.body.message).toContain("Validation failed");
    });

    it("should get all todos", async () => {
      await todoCollection.insertOne({
        title: "Existing Todo",
        completed: false,
        createdAt: new Date().toISOString(),
      });

      const resp = await request(adapter.getInstance()).get("/todos");

      expect(resp.status).toBe(200);
      expect(resp.body).toHaveLength(1);
      expect(resp.body[0].title).toBe("Existing Todo");
    });
  });

  describe("Users API", () => {
    it("should create a new user", async () => {
      const resp = await request(adapter.getInstance())
        .post("/users")
        .send({ name: "Alice", email: "alice@example.com" });

      expect(resp.status).toBe(201);
      expect(resp.body.name).toBe("Alice");
    });

    it("should return 400 for invalid user email", async () => {
      const resp = await request(adapter.getInstance())
        .post("/users")
        .send({ name: "Alice", email: "invalid-email" });

      expect(resp.status).toBe(400);
    });
  });
});
