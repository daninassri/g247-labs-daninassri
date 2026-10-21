// Router del recurso "receta": solo asocia verbo + ruta con una función del controlador.
// Está montado en "/recipes" en app.js, así que "/" significa "/recipes".

const express = require("express");
const {
  listRecipes,
  getStats,
  getRecipe,
  createRecipe,
  replaceRecipe,
  patchRecipe,
  deleteRecipe,
} = require("../controllers/recipesController");

const router = express.Router();

router.get("/", listRecipes);
router.post("/", createRecipe);

// "/stats" va ANTES de "/:id". Si no, Express lo leería como un id.
router.get("/stats", getStats);

router.get("/:id", getRecipe);
router.put("/:id", replaceRecipe);
router.patch("/:id", patchRecipe);
router.delete("/:id", deleteRecipe);

module.exports = router;