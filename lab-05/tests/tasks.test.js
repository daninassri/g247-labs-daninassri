const request = require("supertest");
const app = require("../src/app");

describe("Tasks CRUD API", () => {
  test("GET /tasks -> 200 and an array", async () => {
    const res = await request(app).get("/tasks");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("POST /tasks -> 201 + echoed body + Location header", async () => {
    const res = await request(app).post("/tasks").send({ title: "Study", userId: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "Study" });
    expect(res.body).toHaveProperty("id");
    expect(res.headers.location).toBe(`/tasks/${res.body.id}`);
  });

  test("POST /tasks without a title -> 400", async () => {
    const res = await request(app).post("/tasks").send({ userId: 1 });
    expect(res.status).toBe(400);
  });

  test("GET /tasks/:id -> 200 for an existing task", async () => {
    const created = await request(app).post("/tasks").send({ title: "Read one" });
    const res = await request(app).get(`/tasks/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  test("GET /tasks/999 -> 404 when the task does not exist", async () => {
    const res = await request(app).get("/tasks/999");
    expect(res.status).toBe(404);
  });

  test("PUT /tasks/:id -> 200 and replaces the task", async () => {
    const created = await request(app).post("/tasks").send({ title: "Before" });
    const res = await request(app)
      .put(`/tasks/${created.body.id}`)
      .send({ title: "After", done: true, userId: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: created.body.id, title: "After", done: true });
  });

  test("PUT /tasks/999 -> 404 when the task does not exist", async () => {
    const res = await request(app).put("/tasks/999").send({ title: "Nope" });
    expect(res.status).toBe(404);
  });

  test("DELETE /tasks/:id -> 204, then the task is gone", async () => {
    const created = await request(app).post("/tasks").send({ title: "Temporary" });
    const del = await request(app).delete(`/tasks/${created.body.id}`);
    expect(del.status).toBe(204);
    const after = await request(app).get(`/tasks/${created.body.id}`);
    expect(after.status).toBe(404);
  });

  test("DELETE /tasks/999 -> 404 when the task does not exist", async () => {
    const res = await request(app).delete("/tasks/999");
    expect(res.status).toBe(404);
  });
});