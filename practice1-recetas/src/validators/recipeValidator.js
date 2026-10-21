// Validador del recurso "receta".
// Devuelve { errors, data }:
//   errors: lista con TODAS las incidencias, [{ field, message }, ...]
//   data:   objeto limpio con solo los campos conocidos y ya validados
// Con { partial: true } (PATCH) solo se validan los campos recibidos.

const CATEGORIES = ["entrante", "principal", "postre", "vegetariano", "rapida"];
const MIN_MINUTES = 1;
const MAX_MINUTES = 600;

function validateRecipe(body, { partial = false } = {}) {
  const errors = [];
  const data = {};
  const input = body !== null && typeof body === "object" && !Array.isArray(body) ? body : {};

  // title: texto obligatorio
  if (input.title !== undefined) {
    if (typeof input.title !== "string" || input.title.trim() === "") {
      errors.push({ field: "title", message: "title must be a non-empty string" });
    } else {
      data.title = input.title.trim();
    }
  } else if (!partial) {
    errors.push({ field: "title", message: "title is required" });
  }

  // minutes: entero entre 1 y 600
  if (input.minutes !== undefined) {
    if (!Number.isInteger(input.minutes) || input.minutes < MIN_MINUTES || input.minutes > MAX_MINUTES) {
      errors.push({
        field: "minutes",
        message: "minutes must be an integer between " + MIN_MINUTES + " and " + MAX_MINUTES,
      });
    } else {
      data.minutes = input.minutes;
    }
  } else if (!partial) {
    errors.push({ field: "minutes", message: "minutes is required" });
  }

  // favorite: booleano opcional (por defecto false)
  if (input.favorite !== undefined) {
    if (typeof input.favorite !== "boolean") {
      errors.push({ field: "favorite", message: "favorite must be true or false" });
    } else {
      data.favorite = input.favorite;
    }
  } else if (!partial) {
    data.favorite = false;
  }

  // category: valor de un conjunto cerrado
  if (input.category !== undefined) {
    if (!CATEGORIES.includes(input.category)) {
      errors.push({
        field: "category",
        message: "category must be one of: " + CATEGORIES.join(", "),
      });
    } else {
      data.category = input.category;
    }
  } else if (!partial) {
    errors.push({ field: "category", message: "category is required" });
  }

  // PATCH vacío: no tiene sentido aceptarlo en silencio
  if (partial && errors.length === 0 && Object.keys(data).length === 0) {
    errors.push({ field: "body", message: "at least one field is required" });
  }

  return { errors, data };
}

module.exports = { validateRecipe, CATEGORIES };