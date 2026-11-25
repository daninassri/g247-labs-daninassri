// Acceso a datos de recetas. Recibe la base de datos (db.query) por inyección.
// Todos los valores van parametrizados; la ordenación usa una lista de columnas admitidas.

const COLUMNS = "id, user_id, title, minutes, favorite, category";
const SORT_COLUMNS = {
  id: "id",
  title: "title",
  minutes: "minutes",
  favorite: "favorite",
  category: "category",
};

function createRecipesModel(db) {
  return {
    // Búsqueda, filtros (incluido el propietario), orden y paginación en PostgreSQL.
    // Devuelve { rows, total }: total se calcula sobre el conjunto filtrado, antes de paginar.
    async list({ search, favorite, category, userId, sort = "id", order = "asc", page = 1, limit = 10 } = {}) {
      const where = [];
      const params = [];
      const add = (condition, value) => {
        params.push(value);
        where.push(condition.replace("?", "$" + params.length));
      };

      if (search) add("position(lower(?) in lower(title)) > 0", search);
      if (favorite !== undefined) add("favorite = ?", favorite);
      if (category !== undefined) add("category = ?", category);
      if (userId !== undefined) add("user_id = ?", userId);

      const clause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";
      const column = SORT_COLUMNS[sort] ?? "id";
      const direction = order === "desc" ? "DESC" : "ASC";

      const countResult = await db.query(
        "SELECT COUNT(*)::int AS total FROM recipes " + clause,
        params
      );

      const sql =
        "SELECT " + COLUMNS + " FROM recipes " + clause +
        " ORDER BY " + column + " " + direction + ", id " + direction +
        " LIMIT $" + (params.length + 1) + " OFFSET $" + (params.length + 2);
      const { rows } = await db.query(sql, [...params, limit, (page - 1) * limit]);

      return { rows, total: countResult.rows[0].total };
    },

    async findById(id) {
      const { rows } = await db.query("SELECT " + COLUMNS + " FROM recipes WHERE id = $1", [id]);
      return rows[0] ?? null;
    },

    async create({ userId, title, minutes, favorite, category }) {
      const sql =
        "INSERT INTO recipes (user_id, title, minutes, favorite, category) " +
        "VALUES ($1, $2, $3, $4, $5) RETURNING " + COLUMNS;
      const { rows } = await db.query(sql, [userId, title, minutes, favorite, category]);
      return rows[0];
    },

    // PUT: sustitución completa
    async replace(id, { title, minutes, favorite, category }) {
      const sql =
        "UPDATE recipes SET title = $2, minutes = $3, favorite = $4, category = $5 " +
        "WHERE id = $1 RETURNING " + COLUMNS;
      const { rows } = await db.query(sql, [id, title, minutes, favorite, category]);
      return rows[0] ?? null;
    },

    // PATCH: solo los campos recibidos (ninguno de ellos puede ser null)
    async update(id, changes) {
      const sql =
        "UPDATE recipes SET " +
        "title = COALESCE($2, title), " +
        "minutes = COALESCE($3, minutes), " +
        "favorite = COALESCE($4, favorite), " +
        "category = COALESCE($5, category) " +
        "WHERE id = $1 RETURNING " + COLUMNS;
      const params = [
        id,
        changes.title ?? null,
        changes.minutes ?? null,
        changes.favorite ?? null,
        changes.category ?? null,
      ];
      const { rows } = await db.query(sql, params);
      return rows[0] ?? null;
    },

    async remove(id) {
      const result = await db.query("DELETE FROM recipes WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    // Consulta agregada: totales, favoritas, media de minutos y recuento por categoría.
    async stats() {
      const totals = await db.query(
        "SELECT COUNT(*)::int AS total, " +
          "COUNT(*) FILTER (WHERE favorite)::int AS favorites, " +
          'COALESCE(ROUND(AVG(minutes)::numeric, 1), 0)::float AS "averageMinutes" ' +
          "FROM recipes"
      );
      const groups = await db.query(
        "SELECT category, COUNT(*)::int AS count FROM recipes GROUP BY category"
      );
      return { ...totals.rows[0], groups: groups.rows };
    },
  };
}

module.exports = { createRecipesModel };
