/*
  Starter helper — tests/helpers/fakeDb.js

  Copy this file unchanged. It is a small test double for node-postgres: it
  implements query(text, params) for the six statements used by tasksModel.
  It is test infrastructure, not production code.
*/

function createFakeDb() {
  let tasks = [
    { id: 1, user_id: 1, title: "Buy milk", done: false },
    { id: 2, user_id: 1, title: "Write the SQL schema", done: true },
    { id: 3, user_id: 1, title: "Read the pg docs", done: false },
    { id: 4, user_id: 1, title: "Add pagination", done: false },
    { id: 5, user_id: 2, title: "Set up CI", done: false },
    { id: 6, user_id: 2, title: "Review pull request", done: true },
    { id: 7, user_id: 3, title: "Draft Practice 1 plan", done: false },
  ];
  let nextId = 8;
  const calls = [];

  return {
    calls,

    async query(text, params = []) {
      calls.push({ text, params: [...params] });
      const sql = text.replace(/\s+/g, " ").trim();

      if (sql.startsWith("INSERT INTO tasks")) {
        const [userId, title, done] = params;
        const task = { id: nextId++, user_id: userId, title, done };
        tasks.push(task);
        return { rows: [{ ...task }], rowCount: 1 };
      }

      if (sql.startsWith("UPDATE tasks")) {
        const [id, title, done, userId] = params;
        const task = tasks.find((item) => item.id === id);
        if (!task) return { rows: [], rowCount: 0 };
        if (title !== null) task.title = title;
        if (done !== null) task.done = done;
        if (userId !== null) task.user_id = userId;
        return { rows: [{ ...task }], rowCount: 1 };
      }

      if (sql.startsWith("DELETE FROM tasks")) {
        const index = tasks.findIndex((item) => item.id === params[0]);
        if (index === -1) return { rows: [], rowCount: 0 };
        const [removed] = tasks.splice(index, 1);
        return { rows: [{ id: removed.id }], rowCount: 1 };
      }

      if (sql.includes("WHERE user_id = $1")) {
        const [userId, limit, offset] = params;
        const rows = tasks
          .filter((item) => item.user_id === userId)
          .sort((a, b) => a.id - b.id)
          .slice(offset, offset + limit)
          .map((item) => ({ ...item }));
        return { rows, rowCount: rows.length };
      }

      if (sql.includes("WHERE id = $1")) {
        const task = tasks.find((item) => item.id === params[0]);
        return {
          rows: task ? [{ ...task }] : [],
          rowCount: task ? 1 : 0,
        };
      }

      if (sql.startsWith("SELECT") && sql.includes("FROM tasks")) {
        const rows = tasks
          .sort((a, b) => a.id - b.id)
          .map((item) => ({ ...item }));
        return { rows, rowCount: rows.length };
      }

      throw new Error(`FakeDb: unrecognised SQL -> ${sql}`);
    },
  };
}

module.exports = { createFakeDb };
