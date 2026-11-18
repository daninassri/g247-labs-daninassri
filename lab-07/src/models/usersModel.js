/*
  src/models/usersModel.js
  Mismo patrón que tasksModel: factoría con un db inyectable
  (Pool de pg en producción, un fake en las pruebas).
  Todas las consultas están parametrizadas ($1, $2, ...).
*/

function createUsersModel(db) {
  return {
    // Devuelve la fila COMPLETA (con password_hash, para bcrypt.compare) o null.
    async findByEmail(email) {
      const sql = "SELECT id, email, password_hash, role FROM users WHERE email = $1";
      const { rows } = await db.query(sql, [email]);
      return rows[0] ?? null;
    },

    // Guarda el hash ya calculado. RETURNING no incluye password_hash.
    async create({ email, passwordHash, role = "user" }) {
      const sql =
        "INSERT INTO users (email, password_hash, role) " +
        "VALUES ($1, $2, $3) " +
        "RETURNING id, email, role";
      const { rows } = await db.query(sql, [email, passwordHash, role]);
      return rows[0];
    },
  };
}

module.exports = { createUsersModel };
