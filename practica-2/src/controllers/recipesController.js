// Controlador del recurso "receta". Usa el modelo (PostgreSQL) y el mapper.
const { toRecipeDTO } = require("../mappers/recipeMapper");
const { CATEGORIES } = require("../validators/schemas");
const { parseId } = require("../middleware/ownership");

function createRecipesController({ recipesModel }) {
  return {
    // GET /recipes?search=&favorite=&category=&userId=&sort=&order=&page=&limit=
    async list(req, res) {
      const query = req.valid.query;
      const { rows, total } = await recipesModel.list(query);
      res.status(200).json({
        page: query.page,
        limit: query.limit,
        total,
        items: rows.map(toRecipeDTO),
      });
    },

    // GET /recipes/stats  (se calcula en cada consulta, sobre todas las recetas)
    async stats(req, res) {
      const { total, favorites, averageMinutes, groups } = await recipesModel.stats();
      const byCategory = {};
      CATEGORIES.forEach((c) => {
        byCategory[c] = 0;
      });
      groups.forEach((g) => {
        byCategory[g.category] = g.count;
      });
      res.status(200).json({ total, favorites, averageMinutes, byCategory });
    },

    // GET /recipes/:id
    async getOne(req, res) {
      const id = parseId(req.params.id);
      const recipe = id === null ? null : await recipesModel.findById(id);
      if (!recipe) return res.status(404).json({ error: "Recipe not found" });
      res.status(200).json(toRecipeDTO(recipe));
    },

    // POST /recipes: el propietario es quien tiene la sesión iniciada
    async create(req, res) {
      const created = await recipesModel.create({ ...req.valid.body, userId: req.user.id });
      res.status(201).location("/recipes/" + created.id).json(toRecipeDTO(created));
    },

    // PUT /recipes/:id: sustitución completa (el permiso ya lo comprobó loadOwnedRecipe)
    async replace(req, res) {
      const updated = await recipesModel.replace(req.recipe.id, req.valid.body);
      if (!updated) return res.status(404).json({ error: "Recipe not found" });
      res.status(200).json(toRecipeDTO(updated));
    },

    // PATCH /recipes/:id: solo los campos recibidos
    async patch(req, res) {
      const updated = await recipesModel.update(req.recipe.id, req.valid.body);
      if (!updated) return res.status(404).json({ error: "Recipe not found" });
      res.status(200).json(toRecipeDTO(updated));
    },

    // DELETE /recipes/:id
    async remove(req, res) {
      await recipesModel.remove(req.recipe.id);
      res.status(204).end();
    },
  };
}

module.exports = { createRecipesController };
