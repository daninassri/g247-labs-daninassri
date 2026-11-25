// Rutas de recetas. Las lecturas son públicas; toda escritura exige token (401).
// En PUT, PATCH y DELETE: token -> existe (404) -> es suya o admin (403) -> cuerpo válido (400).
const express = require("express");
const { authenticate } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { createLoadOwnedRecipe } = require("../middleware/ownership");
const { recipeSchema, recipePatchSchema, recipeQuerySchema } = require("../validators/schemas");

function buildRecipesRouter(controller, recipesModel) {
  const router = express.Router();
  const loadOwnedRecipe = createLoadOwnedRecipe(recipesModel);

  router.get("/", validate(recipeQuerySchema, "query"), controller.list);
  router.post("/", authenticate, validate(recipeSchema), controller.create);

  // "/stats" va ANTES de "/:id". Si no, Express lo leería como un id.
  router.get("/stats", controller.stats);

  router.get("/:id", controller.getOne);
  router.put("/:id", authenticate, loadOwnedRecipe, validate(recipeSchema), controller.replace);
  router.patch("/:id", authenticate, loadOwnedRecipe, validate(recipePatchSchema), controller.patch);
  router.delete("/:id", authenticate, loadOwnedRecipe, controller.remove);

  return router;
}

module.exports = { buildRecipesRouter };
