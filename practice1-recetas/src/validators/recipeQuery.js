// Lee y valida los parámetros de consulta de GET /recipes.
// Política: un parámetro desconocido o mal formado se rechaza con 400
// y la lista completa de incidencias.

const { CATEGORIES } = require("./recipeValidator");

const ALLOWED = ["search", "favorite", "category", "sort", "order", "limit", "offset"];
const SORT_FIELDS = ["id", "title", "minutes", "favorite", "category"];
const MAX_LIMIT = 100;

// Devuelve el valor si el parámetro viene una sola vez como texto.
// Un parámetro repetido (?limit=1&limit=2) llega como array y se rechaza.
function single(query, name, errors) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    errors.push({ field: name, message: name + " must appear only once" });
    return undefined;
  }
  return value;
}

function parseRecipeQuery(query) {
  const errors = [];
  const options = { sort: "id", order: "asc", offset: 0 };

  Object.keys(query).forEach((key) => {
    if (!ALLOWED.includes(key)) {
      errors.push({ field: key, message: "unknown query parameter" });
    }
  });

  const search = single(query, "search", errors);
  if (search !== undefined) {
    options.search = search.trim().toLowerCase();
  }

  const favorite = single(query, "favorite", errors);
  if (favorite !== undefined) {
    if (favorite !== "true" && favorite !== "false") {
      errors.push({ field: "favorite", message: "favorite must be true or false" });
    } else {
      options.favorite = favorite === "true";
    }
  }

  const category = single(query, "category", errors);
  if (category !== undefined) {
    if (!CATEGORIES.includes(category)) {
      errors.push({ field: "category", message: "category must be one of: " + CATEGORIES.join(", ") });
    } else {
      options.category = category;
    }
  }

  const sort = single(query, "sort", errors);
  if (sort !== undefined) {
    if (!SORT_FIELDS.includes(sort)) {
      errors.push({ field: "sort", message: "sort must be one of: " + SORT_FIELDS.join(", ") });
    } else {
      options.sort = sort;
    }
  }

  const order = single(query, "order", errors);
  if (order !== undefined) {
    if (order !== "asc" && order !== "desc") {
      errors.push({ field: "order", message: "order must be asc or desc" });
    } else {
      options.order = order;
    }
  }

  const limit = single(query, "limit", errors);
  if (limit !== undefined) {
    if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > MAX_LIMIT) {
      errors.push({ field: "limit", message: "limit must be an integer between 1 and " + MAX_LIMIT });
    } else {
      options.limit = Number(limit);
    }
  }

  const offset = single(query, "offset", errors);
  if (offset !== undefined) {
    if (!/^\d+$/.test(offset)) {
      errors.push({ field: "offset", message: "offset must be an integer of 0 or more" });
    } else {
      options.offset = Number(offset);
    }
  }

  return { errors, options };
}

module.exports = { parseRecipeQuery };