/*
  Starter test — tests/tasksModel.test.js

  Copy this file unchanged and run `npm test`. Complete tasksModel.js until
  every test passes. Do not weaken the assertions.
*/

const test = require("node:test");
const assert = require("node:assert/strict");
const { createTasksModel } = require("../src/models/tasksModel");
const { createFakeDb } = require("./helpers/fakeDb");

function setup() {
  const db = createFakeDb();
  return { db, model: createTasksModel(db) };
}

test("findAll returns every task in a stable order", async () => {
  const { model } = setup();
  const tasks = await model.findAll();
  assert.equal(tasks.length, 7);
  assert.deepEqual(tasks.map((task) => task.id), [1, 2, 3, 4, 5, 6, 7]);
});

test("findById returns a row or null", async () => {
  const { model } = setup();
  assert.equal((await model.findById(1)).title, "Buy milk");
  assert.equal(await model.findById(999), null);
});

test("create returns the database row and defaults done to false", async () => {
  const { model } = setup();
  const created = await model.create({ title: "Learn JOINs", userId: 2 });
  assert.deepEqual(created, {
    id: 8,
    user_id: 2,
    title: "Learn JOINs",
    done: false,
  });
});

test("update changes provided fields and accepts false", async () => {
  const { model } = setup();
  const changed = await model.update(2, { title: "Revised", done: false });
  assert.equal(changed.title, "Revised");
  assert.equal(changed.done, false);
  assert.equal(changed.user_id, 1);
});

test("update returns null when the task does not exist", async () => {
  const { model } = setup();
  assert.equal(await model.update(999, { done: true }), null);
});

test("remove reports whether a row was deleted", async () => {
  const { model } = setup();
  assert.equal(await model.remove(1), true);
  assert.equal(await model.remove(1), false);
});

test("findByOwner filters and paginates with stable offsets", async () => {
  const { model } = setup();
  const first = await model.findByOwner(1, { limit: 2, offset: 0 });
  const second = await model.findByOwner(1, { limit: 2, offset: 2 });
  assert.deepEqual(first.map((task) => task.id), [1, 2]);
  assert.deepEqual(second.map((task) => task.id), [3, 4]);
});

test("external values travel as parameters, not SQL text", async () => {
  const { db, model } = setup();
  const externalValue = "1 OR 1=1";
  await model.findById(externalValue);
  const call = db.calls.at(-1);
  assert.match(call.text, /WHERE id = \$1/);
  assert.equal(call.text.includes(externalValue), false);
  assert.deepEqual(call.params, [externalValue]);
});
