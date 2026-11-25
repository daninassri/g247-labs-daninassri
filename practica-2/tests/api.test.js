// Pruebas de la API contra PostgreSQL real (DATABASE_URL y JWT_SECRET del .env).
// Cada ejecución crea sus propios usuarios "test-…" y los borra al terminar
// (ON DELETE CASCADE elimina también sus recetas), así que es repetible.
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const { buildApp } = require("../src/app");

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const app = buildApp(db, { log: false });
const tag = "test-" + Date.now();
const PASSWORD = "password123";
const bearer = (token) => ({ Authorization: "Bearer " + token });

async function signUp(name) {
  const email = `${tag}-${name}@example.com`;
  const reg = await request(app).post("/auth/register").send({ email, password: PASSWORD });
  assert.equal(reg.status, 201);
  const login = await request(app).post("/auth/login").send({ email, password: PASSWORD });
  assert.equal(login.status, 200);
  return { id: reg.body.id, email, token: login.body.token };
}

async function makeAdmin() {
  const email = `${tag}-admin@example.com`;
  const hash = await bcrypt.hash(PASSWORD, 10);
  await db.query("INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')", [email, hash]);
  const login = await request(app).post("/auth/login").send({ email, password: PASSWORD });
  assert.equal(login.status, 200);
  return { token: login.body.token };
}

const newRecipe = (token, body) => request(app).post("/recipes").set(bearer(token)).send(body);
const valid = { title: "Pisto", minutes: 40, category: "vegetariano" };

test.after(async () => {
  await db.query("DELETE FROM users WHERE email LIKE $1", [tag + "-%"]);
  await db.end();
});

test("health and unknown route", async () => {
  assert.deepEqual((await request(app).get("/health")).body, { status: "ok" });
  const nope = await request(app).get("/nope");
  assert.equal(nope.status, 404);
  assert.deepEqual(nope.body, { error: "Route not found" });
});

test("register: 201 without hash, 409 duplicate, 400 invalid, role ignored", async () => {
  const email = `${tag}-reg@example.com`;
  const ok = await request(app).post("/auth/register").send({ email, password: PASSWORD, role: "admin" });
  assert.equal(ok.status, 201);
  assert.deepEqual(Object.keys(ok.body).sort(), ["email", "id"]);
  const row = await db.query("SELECT role, password_hash FROM users WHERE email = $1", [email]);
  assert.equal(row.rows[0].role, "user");
  assert.match(row.rows[0].password_hash, /^\$2[aby]\$10\$/);

  const dup = await request(app).post("/auth/register").send({ email: email.toUpperCase(), password: PASSWORD });
  assert.equal(dup.status, 409);

  const send = (body) => request(app).post("/auth/register").send(body);
  assert.equal((await send({ email, password: "short" })).status, 400);
  assert.equal((await send({ email: "nope", password: PASSWORD })).status, 400);
  assert.equal((await send({ password: PASSWORD })).status, 400);
  assert.equal((await send({ email: `${tag}-long@example.com`, password: "a".repeat(73) })).status, 400);
});

test("login: 200 with token, 401 for any bad credentials, 400 only when fields are missing", async () => {
  const u = await signUp("login");
  assert.equal(typeof u.token, "string");
  const login = (body) => request(app).post("/auth/login").send(body);
  assert.equal((await login({ email: u.email, password: "wrong-password" })).status, 401);
  assert.equal((await login({ email: u.email, password: "short" })).status, 401);
  assert.equal((await login({ email: "nobody@example.com", password: PASSWORD })).status, 401);
  assert.equal((await login({ email: "not-an-email", password: PASSWORD })).status, 401);
  assert.equal((await login({ email: u.email })).status, 400);
});

test("/auth/me returns the token owner; bad tokens return 401", async () => {
  const u = await signUp("me");
  const me = await request(app).get("/auth/me").set(bearer(u.token));
  assert.equal(me.status, 200);
  assert.deepEqual(me.body, { id: u.id, email: u.email, role: "user" });
  assert.equal((await request(app).get("/auth/me")).status, 401);
  assert.equal((await request(app).get("/auth/me").set(bearer("not.a.token"))).status, 401);
  assert.equal((await request(app).get("/auth/me").set({ Authorization: "Token abc" })).status, 401);
});

test("writes require a token (401); reads are public", async () => {
  assert.equal((await request(app).post("/recipes").send(valid)).status, 401);
  assert.equal((await request(app).put("/recipes/1").send(valid)).status, 401);
  assert.equal((await request(app).patch("/recipes/1").send({ title: "x" })).status, 401);
  assert.equal((await request(app).delete("/recipes/1")).status, 401);
  assert.equal((await request(app).get("/recipes")).status, 200);
  assert.equal((await request(app).get("/recipes/stats")).status, 200);
});

test("POST: 201 + Location, owner from token, defaults, unknown fields dropped", async () => {
  const ana = await signUp("post");
  const ben = await signUp("post2");
  const res = await newRecipe(ana.token, { ...valid, title: "  Pisto  ", userId: ben.id, id: 999, extra: 1 });
  assert.equal(res.status, 201);
  assert.equal(res.headers.location, "/recipes/" + res.body.id);
  assert.deepEqual(res.body, {
    id: res.body.id, title: "Pisto", minutes: 40, favorite: false, category: "vegetariano", userId: ana.id,
  });
  assert.notEqual(res.body.id, 999);
});

test("POST: 400 lists every field problem", async () => {
  const ana = await signUp("val");
  const empty = await newRecipe(ana.token, {});
  assert.equal(empty.status, 400);
  assert.deepEqual(empty.body.errors.map((e) => e.field).sort(), ["category", "minutes", "title"]);
  const bad = async (body) => (await newRecipe(ana.token, body)).status;
  assert.equal(await bad({ ...valid, title: "   " }), 400);
  assert.equal(await bad({ ...valid, minutes: "40" }), 400);
  assert.equal(await bad({ ...valid, minutes: 40.5 }), 400);
  assert.equal(await bad({ ...valid, minutes: 0 }), 400);
  assert.equal(await bad({ ...valid, minutes: 601 }), 400);
  assert.equal(await bad({ ...valid, favorite: null }), 400);
  assert.equal(await bad({ ...valid, category: "Postre" }), 400);
  assert.equal(await bad({ ...valid, minutes: 40.0 }), 201);
  const malformed = await request(app)
    .post("/recipes").set(bearer(ana.token)).set("Content-Type", "application/json").send("{bad");
  assert.equal(malformed.status, 400);
});

test("owner can GET, PUT, PATCH and DELETE; 404 afterwards", async () => {
  const ana = await signUp("own");
  const id = (await newRecipe(ana.token, valid)).body.id;

  const get = await request(app).get("/recipes/" + id);
  assert.equal(get.status, 200);

  const put = await request(app).put("/recipes/" + id).set(bearer(ana.token))
    .send({ title: "Nuevo", minutes: 10, category: "rapida" });
  assert.equal(put.status, 200);
  assert.deepEqual(put.body, { id, title: "Nuevo", minutes: 10, favorite: false, category: "rapida", userId: ana.id });

  const patch = await request(app).patch("/recipes/" + id).set(bearer(ana.token)).send({ favorite: true });
  assert.equal(patch.status, 200);
  assert.equal(patch.body.favorite, true);
  assert.equal(patch.body.title, "Nuevo");

  assert.equal((await request(app).patch("/recipes/" + id).set(bearer(ana.token)).send({})).status, 400);
  assert.equal((await request(app).patch("/recipes/" + id).set(bearer(ana.token)).send({ minutes: 0, title: "ok" })).status, 400);
  assert.equal((await request(app).get("/recipes/" + id)).body.title, "Nuevo");

  const del = await request(app).delete("/recipes/" + id).set(bearer(ana.token));
  assert.equal(del.status, 204);
  assert.equal((await request(app).get("/recipes/" + id)).status, 404);
  assert.equal((await request(app).delete("/recipes/" + id).set(bearer(ana.token))).status, 404);
});

test("another user gets 403; admin can edit and delete anything", async () => {
  const ana = await signUp("a");
  const ben = await signUp("b");
  const admin = await makeAdmin();
  const id = (await newRecipe(ana.token, valid)).body.id;

  assert.equal((await request(app).put("/recipes/" + id).set(bearer(ben.token)).send(valid)).status, 403);
  assert.equal((await request(app).patch("/recipes/" + id).set(bearer(ben.token)).send({ title: "x" })).status, 403);
  assert.equal((await request(app).delete("/recipes/" + id).set(bearer(ben.token))).status, 403);
  assert.equal((await request(app).get("/recipes/" + id)).body.title, "Pisto");

  const asAdmin = await request(app).patch("/recipes/" + id).set(bearer(admin.token)).send({ title: "Admin" });
  assert.equal(asAdmin.status, 200);
  assert.equal(asAdmin.body.userId, ana.id); // el propietario no cambia
  assert.equal((await request(app).delete("/recipes/" + id).set(bearer(admin.token))).status, 204);
});

test("missing or non-canonical ids return 404, never 500 (404 wins over body validation)", async () => {
  const ana = await signUp("ids");
  for (const id of ["99999999", "abc", "01", "1.5", "-1", "1e0", "99999999999"]) {
    assert.equal((await request(app).get("/recipes/" + id)).status, 404, "GET " + id);
    assert.equal((await request(app).put("/recipes/" + id).set(bearer(ana.token)).send({})).status, 404, "PUT " + id);
  }
});

test("GET /recipes: pagination, total before paginating, owner filter", async () => {
  const ana = await signUp("page");
  for (let i = 1; i <= 25; i++) {
    await newRecipe(ana.token, { title: "Receta " + String(i).padStart(2, "0"), minutes: i, category: i % 2 ? "postre" : "rapida" });
  }
  const get = (q) => request(app).get("/recipes?userId=" + ana.id + q);

  const first = await get("");
  assert.equal(first.status, 200);
  assert.equal(first.body.page, 1);
  assert.equal(first.body.limit, 10);
  assert.equal(first.body.total, 25);
  assert.equal(first.body.items.length, 10);
  assert.ok(first.body.items.every((r) => r.userId === ana.id));

  const p3 = await get("&page=3&limit=10");
  assert.equal(p3.body.total, 25);
  assert.equal(p3.body.items.length, 5);
  assert.deepEqual((await get("&page=4")).body.items, []);

  const p1 = await get("&page=1&limit=5&sort=minutes&order=desc");
  const p2 = await get("&page=2&limit=5&sort=minutes&order=desc");
  assert.deepEqual(p1.body.items.map((r) => r.minutes), [25, 24, 23, 22, 21]);
  assert.deepEqual(p2.body.items.map((r) => r.minutes), [20, 19, 18, 17, 16]);

  // el total se calcula sobre el conjunto filtrado
  const filtered = await get("&category=postre&limit=3");
  assert.equal(filtered.body.total, 13);
  assert.equal(filtered.body.items.length, 3);
  const searched = await get("&search=RECETA 07");
  assert.equal(searched.body.total, 1);
  assert.equal((await get("&search=100%25")).body.total, 0); // % no actúa como comodín
});

test("GET /recipes: invalid or unknown query parameters return 400 with all issues", async () => {
  const res = await request(app).get("/recipes?limit=abc&sort=color&foo=1");
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.errors.map((e) => e.field).sort(), ["foo", "limit", "sort"]);
  for (const q of ["page=0", "limit=0", "limit=101", "limit=1.5", "page=-1", "favorite=TRUE", "order=ASC",
    "category=Postre", "userId=abc", "userId=99999999999", "limit=", "limit=1&limit=2", "offset=1"]) {
    assert.equal((await request(app).get("/recipes?" + q)).status, 400, q);
  }
  assert.equal((await request(app).get("/recipes?search=")).status, 200);
});

test("/stats is an aggregate with the P1 shape over every recipe", async () => {
  const res = await request(app).get("/recipes/stats");
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body).sort(), ["averageMinutes", "byCategory", "favorites", "total"]);
  assert.deepEqual(Object.keys(res.body.byCategory).sort(), ["entrante", "postre", "principal", "rapida", "vegetariano"]);
  const list = await request(app).get("/recipes?limit=1");
  assert.equal(res.body.total, list.body.total); // mismo alcance que el listado
  assert.equal(Object.values(res.body.byCategory).reduce((a, b) => a + b, 0), res.body.total);
});
