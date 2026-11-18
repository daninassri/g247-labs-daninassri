// El secreto debe existir ANTES de cargar la app (los módulos lo leen al cargarse).
process.env.JWT_SECRET = "test-secret-only-for-tests";

const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { buildApp } = require("../src/app");

// Base de datos falsa en memoria: implementa query(text, params) para las
// consultas de usersModel y tasksModel. No hace falta PostgreSQL.
function createFakeDb() {
  const users = [];
  const tasks = [];
  let nextUserId = 1;
  let nextTaskId = 1;

  return {
    users,
    tasks,
    async query(text, params = []) {
      const sql = text.replace(/\s+/g, " ").trim();

      if (sql.startsWith("INSERT INTO users")) {
        const [email, passwordHash, role] = params;
        const user = { id: nextUserId++, email, password_hash: passwordHash, role };
        users.push(user);
        return { rows: [{ id: user.id, email: user.email, role: user.role }], rowCount: 1 };
      }

      if (sql.includes("FROM users WHERE email = $1")) {
        const user = users.find((u) => u.email === params[0]);
        return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
      }

      if (sql.startsWith("INSERT INTO tasks")) {
        const [userId, title, done] = params;
        const task = { id: nextTaskId++, user_id: userId, title, done };
        tasks.push(task);
        return { rows: [{ ...task }], rowCount: 1 };
      }

      if (sql.startsWith("UPDATE tasks")) {
        const [id, title, done, userId] = params;
        const task = tasks.find((t) => t.id === id);
        if (!task) return { rows: [], rowCount: 0 };
        if (title !== null) task.title = title;
        if (done !== null) task.done = done;
        if (userId !== null) task.user_id = userId;
        return { rows: [{ ...task }], rowCount: 1 };
      }

      if (sql.startsWith("DELETE FROM tasks")) {
        const index = tasks.findIndex((t) => t.id === params[0]);
        if (index === -1) return { rows: [], rowCount: 0 };
        const [removed] = tasks.splice(index, 1);
        return { rows: [{ id: removed.id }], rowCount: 1 };
      }

      if (sql.includes("WHERE user_id = $1")) {
        const [userId, limit, offset] = params;
        const rows = tasks
          .filter((t) => t.user_id === userId)
          .sort((a, b) => a.id - b.id)
          .slice(offset, offset + limit)
          .map((t) => ({ ...t }));
        return { rows, rowCount: rows.length };
      }

      if (sql.includes("WHERE id = $1")) {
        const task = tasks.find((t) => t.id === params[0]);
        return { rows: task ? [{ ...task }] : [], rowCount: task ? 1 : 0 };
      }

      throw new Error("FakeDb: unrecognised SQL -> " + sql);
    },
  };
}

function setup() {
  const db = createFakeDb();
  return { db, app: buildApp(db) };
}

// Registra un usuario, inicia sesión y devuelve { id, token }
async function signUp(app, email, password = "password123") {
  const reg = await request(app).post("/auth/register").send({ email, password });
  assert.equal(reg.status, 201);
  const login = await request(app).post("/auth/login").send({ email, password });
  assert.equal(login.status, 200);
  return { id: reg.body.id, token: login.body.token };
}

const bearer = (token) => ({ Authorization: "Bearer " + token });

// ---------- Infraestructura ----------

test("health route is available", async () => {
  const { app } = setup();
  const response = await request(app).get("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("task routes require a token", async () => {
  const { app } = setup();
  const response = await request(app).get("/tasks").timeout(1000);
  assert.equal(response.status, 401);
});

test("unknown route returns a JSON 404", async () => {
  const { app } = setup();
  const response = await request(app).get("/nope");
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: "Route not found" });
});

// ---------- Registro ----------

test("register returns 201 with id and email, never the hash", async () => {
  const { app, db } = setup();
  const response = await request(app)
    .post("/auth/register")
    .send({ email: "ana@example.com", password: "password123" });
  assert.equal(response.status, 201);
  assert.deepEqual(response.body, { id: 1, email: "ana@example.com" });
  // La contraseña se guarda como hash bcrypt, no en claro
  assert.notEqual(db.users[0].password_hash, "password123");
  assert.match(db.users[0].password_hash, /^\$2[aby]\$10\$/);
});

test("register rejects a duplicate email with 409", async () => {
  const { app } = setup();
  await signUp(app, "ana@example.com");
  const response = await request(app)
    .post("/auth/register")
    .send({ email: "ana@example.com", password: "password123" });
  assert.equal(response.status, 409);
});

test("register rejects bad input with 400", async () => {
  const { app } = setup();
  const send = (body) => request(app).post("/auth/register").send(body);
  assert.equal((await send({ email: "ana@example.com", password: "short" })).status, 400);
  assert.equal((await send({ email: "", password: "password123" })).status, 400);
  assert.equal((await send({ email: "not-an-email", password: "password123" })).status, 400);
  assert.equal((await send({ password: "password123" })).status, 400);
  // 73 bytes UTF-8: supera el límite de bcrypt y se rechaza, no se trunca
  assert.equal((await send({ email: "ana@example.com", password: "a".repeat(73) })).status, 400);
  // 36 caracteres de 2 bytes = 72 bytes: es válida
  assert.equal((await send({ email: "ok@example.com", password: "é".repeat(36) })).status, 201);
});

// ---------- Login ----------

test("login returns a JWT; wrong credentials return 401", async () => {
  const { app } = setup();
  await signUp(app, "ana@example.com");

  const ok = await request(app)
    .post("/auth/login")
    .send({ email: "ana@example.com", password: "password123" });
  assert.equal(ok.status, 200);
  assert.equal(typeof ok.body.token, "string");

  const wrongPassword = await request(app)
    .post("/auth/login")
    .send({ email: "ana@example.com", password: "wrong-password" });
  assert.equal(wrongPassword.status, 401);

  const unknownUser = await request(app)
    .post("/auth/login")
    .send({ email: "nobody@example.com", password: "password123" });
  assert.equal(unknownUser.status, 401);
});

// ---------- 401: autenticación ----------

test("invalid or malformed tokens return 401", async () => {
  const { app } = setup();
  const garbage = await request(app).get("/tasks").set(bearer("not.a.token"));
  assert.equal(garbage.status, 401);
  const noBearer = await request(app).get("/tasks").set({ Authorization: "Token abc" });
  assert.equal(noBearer.status, 401);
});

// ---------- 400: validación ----------

test("POST /tasks validates the body with 400", async () => {
  const { app } = setup();
  const { token } = await signUp(app, "ana@example.com");
  const post = (body) => request(app).post("/tasks").set(bearer(token)).send(body);
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ title: "" })).status, 400);
  assert.equal((await post({ title: "   " })).status, 400);
  assert.equal((await post({ title: 123 })).status, 400);
  assert.equal((await post({ title: "x".repeat(121) })).status, 400);
  assert.equal((await post({ title: "ok", done: "yes" })).status, 400);
});

test("malformed JSON returns 400", async () => {
  const { app } = setup();
  const { token } = await signUp(app, "ana@example.com");
  const response = await request(app)
    .post("/tasks")
    .set(bearer(token))
    .set("Content-Type", "application/json")
    .send("{bad json");
  assert.equal(response.status, 400);
});

// ---------- Crear y propiedad ----------

test("POST /tasks creates a task owned by the token user, ignoring userId in the body", async () => {
  const { app } = setup();
  const ana = await signUp(app, "ana@example.com");
  const ben = await signUp(app, "ben@example.com");

  const response = await request(app)
    .post("/tasks")
    .set(bearer(ana.token))
    .send({ title: "  Study JWT  ", userId: ben.id });

  assert.equal(response.status, 201);
  assert.equal(response.headers.location, "/tasks/" + response.body.id);
  assert.deepEqual(response.body, {
    id: response.body.id,
    title: "Study JWT",
    done: false,
    userId: ana.id,
  });
});

test("owner can read, replace and delete their task", async () => {
  const { app } = setup();
  const ana = await signUp(app, "ana@example.com");
  const created = await request(app).post("/tasks").set(bearer(ana.token)).send({ title: "Mine" });
  const id = created.body.id;

  const got = await request(app).get("/tasks/" + id).set(bearer(ana.token));
  assert.equal(got.status, 200);
  assert.equal(got.body.title, "Mine");

  const put = await request(app)
    .put("/tasks/" + id)
    .set(bearer(ana.token))
    .send({ title: "Renamed", done: true });
  assert.equal(put.status, 200);
  assert.deepEqual(put.body, { id, title: "Renamed", done: true, userId: ana.id });

  const del = await request(app).delete("/tasks/" + id).set(bearer(ana.token));
  assert.equal(del.status, 204);
  assert.equal(del.text, "");

  const gone = await request(app).get("/tasks/" + id).set(bearer(ana.token));
  assert.equal(gone.status, 404);
});

// ---------- 403: autorización ----------

test("another user's task returns 403 on GET, PUT and DELETE", async () => {
  const { app, db } = setup();
  const ana = await signUp(app, "ana@example.com");
  const ben = await signUp(app, "ben@example.com");
  const created = await request(app).post("/tasks").set(bearer(ana.token)).send({ title: "Private" });
  const id = created.body.id;

  const get = await request(app).get("/tasks/" + id).set(bearer(ben.token));
  assert.equal(get.status, 403);

  const put = await request(app)
    .put("/tasks/" + id)
    .set(bearer(ben.token))
    .send({ title: "Hacked" });
  assert.equal(put.status, 403);

  const del = await request(app).delete("/tasks/" + id).set(bearer(ben.token));
  assert.equal(del.status, 403);

  // La tarea sigue intacta
  assert.equal(db.tasks.length, 1);
  assert.equal(db.tasks[0].title, "Private");
});

test("missing or invalid ids return 404, not 500", async () => {
  const { app } = setup();
  const { token } = await signUp(app, "ana@example.com");
  for (const id of ["999", "abc", "01", "1.5", "-1", "99999999999"]) {
    const response = await request(app).get("/tasks/" + id).set(bearer(token));
    assert.equal(response.status, 404, "GET /tasks/" + id);
  }
});

// ---------- Paginación ----------

test("GET /tasks paginates only the caller's tasks and normalizes page and limit", async () => {
  const { app } = setup();
  const ana = await signUp(app, "ana@example.com");
  const ben = await signUp(app, "ben@example.com");
  for (let i = 1; i <= 25; i++) {
    await request(app).post("/tasks").set(bearer(ana.token)).send({ title: "Task " + i });
  }
  await request(app).post("/tasks").set(bearer(ben.token)).send({ title: "Ben's task" });

  const get = (query) => request(app).get("/tasks" + query).set(bearer(ana.token));

  // Valores por defecto: page 1, limit 20
  const first = await get("");
  assert.equal(first.status, 200);
  assert.equal(first.body.page, 1);
  assert.equal(first.body.limit, 20);
  assert.equal(first.body.items.length, 20);
  assert.ok(first.body.items.every((t) => t.userId === ana.id));

  // Segunda página
  const second = await get("?page=2&limit=20");
  assert.equal(second.body.items.length, 5);

  // Dos desplazamientos distintos devuelven filas distintas
  const p1 = await get("?page=1&limit=10");
  const p2 = await get("?page=2&limit=10");
  assert.notDeepEqual(p1.body.items.map((t) => t.id), p2.body.items.map((t) => t.id));

  // limit=999 -> 100; page=0 -> 1
  const big = await get("?limit=999&page=0");
  assert.equal(big.body.limit, 100);
  assert.equal(big.body.page, 1);
  assert.equal(big.body.items.length, 25);

  // No enteros -> valores por defecto
  const junk = await get("?page=abc&limit=1.5");
  assert.equal(junk.body.page, 1);
  assert.equal(junk.body.limit, 20);

  // Límite superior de page
  const far = await get("?page=999999999");
  assert.equal(far.body.page, 100000);
  assert.deepEqual(far.body.items, []);
});
