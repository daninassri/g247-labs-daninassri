// loadOwnedRecipe: carga la receta de :id y comprueba el permiso.
//   id no válido o inexistente -> 404
//   receta de otro usuario (y quien llama no es admin) -> 403
// El propietario sale siempre del token, nunca del cuerpo.
const MAX_ID = 2147483647; // límite de INT en PostgreSQL

// Id canónico: solo dígitos, sin ceros a la izquierda y dentro del rango de INT
function parseId(raw) {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return n <= MAX_ID ? n : null;
}

function createLoadOwnedRecipe(recipesModel) {
  return async function loadOwnedRecipe(req, res, next) {
    const id = parseId(req.params.id);
    const recipe = id === null ? null : await recipesModel.findById(id);
    if (!recipe) return res.status(404).json({ error: "Recipe not found" });

    const isOwner = recipe.user_id === req.user.id;
    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
    req.recipe = recipe;
    next();
  };
}

module.exports = { createLoadOwnedRecipe, parseId };
