// Controlador del recurso "receta".
// No toca el array: usa el almacén (data/store.js) y los validadores.

const store = require("../data/store");
const { validateRecipe, CATEGORIES } = require("../validators/recipeValidator");
const { parseRecipeQuery } = require("../validators/recipeQuery");

function compareBy(field) {
  return (a, b) => {
    if (typeof a[field] === "string") return a[field].localeCompare(b[field]);
    return Number(a[field]) - Number(b[field]);
  };
}

// GET /recipes?search=&favorite=&category=&sort=&order=&limit=&offset=
function listRecipes(req, res) {
  const { errors, options } = parseRecipeQuery(req.query);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  let result = store.findAll();

  // 1. filtrar
  if (options.search !== undefined) {
    result = result.filter((r) => r.title.toLowerCase().includes(options.search));
  }
  if (options.favorite !== undefined) {
    result = result.filter((r) => r.favorite === options.favorite);
  }
  if (options.category !== undefined) {
    result = result.filter((r) => r.category === options.category);
  }

  // 2. ordenar
  result.sort(compareBy(options.sort));
  if (options.order === "desc") {
    result.reverse();
  }

  // 3. paginar
  const end = options.limit === undefined ? undefined : options.offset + options.limit;
  result = result.slice(options.offset, end);

  res.status(200).json(result);
}

// GET /recipes/stats  (se calcula en cada petición, nunca se guarda)
function getStats(req, res) {
  const all = store.findAll();
  const byCategory = {};
  CATEGORIES.forEach((c) => {
    byCategory[c] = 0;
  });

  let totalMinutes = 0;
  let favorites = 0;
  all.forEach((r) => {
    byCategory[r.category] += 1;
    totalMinutes += r.minutes;
    if (r.favorite) favorites += 1;
  });

  res.status(200).json({
    total: all.length,
    favorites: favorites,
    averageMinutes: all.length === 0 ? 0 : Math.round((totalMinutes / all.length) * 10) / 10,
    byCategory: byCategory,
  });
}

// GET /recipes/:id
function getRecipe(req, res) {
  const recipe = store.findById(Number(req.params.id));
  if (!recipe) {
    return res.status(404).json({ error: "Recipe not found" });
  }
  res.status(200).json(recipe);
}

// POST /recipes
function createRecipe(req, res) {
  const { errors, data } = validateRecipe(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  const recipe = store.create(data);
  res.status(201).location("/recipes/" + recipe.id).json(recipe);
}

// PUT /recipes/:id  (sustituye la receta completa)
function replaceRecipe(req, res) {
  const id = Number(req.params.id);
  if (!store.findById(id)) {
    return res.status(404).json({ error: "Recipe not found" });
  }
  const { errors, data } = validateRecipe(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  res.status(200).json(store.replace(id, data));
}

// PATCH /recipes/:id  (cambia solo los campos recibidos)
function patchRecipe(req, res) {
  const id = Number(req.params.id);
  if (!store.findById(id)) {
    return res.status(404).json({ error: "Recipe not found" });
  }
  const { errors, data } = validateRecipe(req.body, { partial: true });
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  res.status(200).json(store.update(id, data));
}

// DELETE /recipes/:id
function deleteRecipe(req, res) {
  const removed = store.remove(Number(req.params.id));
  if (!removed) {
    return res.status(404).json({ error: "Recipe not found" });
  }
  res.status(204).end();
}

module.exports = {
  listRecipes,
  getStats,
  getRecipe,
  createRecipe,
  replaceRecipe,
  patchRecipe,
  deleteRecipe,
};