// Acceso a datos de usuarios. Recibe la base de datos (db.query) por inyección.
function createUsersModel(db) {
  return {
    async create({ email, passwordHash }) {
      const sql =
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) " +
        "RETURNING id, email, role";
      const { rows } = await db.query(sql, [email, passwordHash]);
      return rows[0];
    },

    async findByEmail(email) {
      const sql = "SELECT id, email, password_hash, role FROM users WHERE email = $1";
      const { rows } = await db.query(sql, [email]);
      return rows[0] ?? null;
    },

    async findById(id) {
      const sql = "SELECT id, email, role FROM users WHERE id = $1";
      const { rows } = await db.query(sql, [id]);
      return rows[0] ?? null;
    },
  };
}

module.exports = { createUsersModel };
