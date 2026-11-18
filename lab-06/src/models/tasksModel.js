/*
  src/models/tasksModel.js
  Session 22 Lab · Web Application Programming (G247) · CUNEF EPS

  Models seam: createTasksModel(db) receives a db with an async
  query(text, params) method (a pg Pool in real use, a fake in tests).
  Every query is PARAMETERIZED ($1, $2, ...). User input is never
  concatenated into the SQL text.
*/

function createTasksModel(db) {
  return {
    // All tasks, ordered so results are stable.
    async findAll() {
      const sql = "SELECT id, user_id, title, done FROM tasks ORDER BY id";
      const { rows } = await db.query(sql, []);
      return rows;
    },

    // One task by id: the row, or null if there is none.
    async findById(id) {
      const sql = "SELECT id, user_id, title, done FROM tasks WHERE id = $1";
      const { rows } = await db.query(sql, [id]);
      return rows[0] ?? null;
    },

    // Create a task. RETURNING gives the stored row, including the SERIAL id.
    async create({ title, userId, done = false }) {
      const sql =
        "INSERT INTO tasks (user_id, title, done) " +
        "VALUES ($1, $2, $3) " +
        "RETURNING id, user_id, title, done";
      const { rows } = await db.query(sql, [userId, title, done]);
      return rows[0];
    },

    // Update only the fields received. COALESCE keeps the current value when
    // the parameter is NULL. "??" (not "||") keeps done = false as a valid value.
    async update(id, fields) {
      const f = fields || {};
      const sql =
        "UPDATE tasks " +
        "SET title = COALESCE($2, title), " +
        "done = COALESCE($3, done), " +
        "user_id = COALESCE($4, user_id) " +
        "WHERE id = $1 " +
        "RETURNING id, user_id, title, done";
      const params = [id, f.title ?? null, f.done ?? null, f.userId ?? null];
      const { rows } = await db.query(sql, params);
      return rows[0] ?? null;
    },

    // Delete a task: true if a row was removed, false if the id did not exist.
    async remove(id) {
      const sql = "DELETE FROM tasks WHERE id = $1 RETURNING id";
      const result = await db.query(sql, [id]);
      return result.rowCount > 0;
    },

    // One owner's tasks, paginated. ORDER BY id keeps the pages stable.
    async findByOwner(userId, { limit = 10, offset = 0 } = {}) {
      const sql =
        "SELECT id, user_id, title, done FROM tasks " +
        "WHERE user_id = $1 " +
        "ORDER BY id " +
        "LIMIT $2 OFFSET $3";
      const { rows } = await db.query(sql, [userId, limit, offset]);
      return rows;
    },
  };
}

module.exports = { createTasksModel };
