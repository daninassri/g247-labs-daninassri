// Cliente web de SaborCasero.
// Consume la API REST /recipes con fetch. Sin frameworks.
// El filtrado lo hace el servidor: aquí solo se construye la consulta.

const API = "/recipes";
const CONNECTION_ERROR = "No se pudo conectar con el servidor. Comprueba que está en marcha.";
const CATEGORY_LABELS = {
  entrante: "Entrante",
  principal: "Plato principal",
  postre: "Postre",
  vegetariano: "Vegetariano",
  rapida: "Rápida",
};
const FIELDS = ["title", "minutes", "category", "favorite"];

const listEl = document.getElementById("recipeList");
const loadingEl = document.getElementById("loading");
const statusEl = document.getElementById("status");
const form = document.getElementById("recipeForm");
const formTitle = document.getElementById("formTitle");
const formMessage = document.getElementById("formMessage");
const submitBtn = document.getElementById("submitBtn");
const cancelBtn = document.getElementById("cancelBtn");
const searchInput = document.getElementById("search");
const filterCategory = document.getElementById("filterCategory");
const filterFavorite = document.getElementById("filterFavorite");
const inputs = {
  title: document.getElementById("title"),
  minutes: document.getElementById("minutes"),
  category: document.getElementById("category"),
  favorite: document.getElementById("favorite"),
};

let editingId = null; // id de la receta que se está editando (null = creando)
let pending = 0; // peticiones en curso
let loadCounter = 0; // para ignorar respuestas antiguas del listado
let searchTimer = null;

// ---------- Utilidades ----------

function setLoading(isLoading) {
  pending += isLoading ? 1 : -1;
  loadingEl.hidden = pending === 0;
}

// fetch NO considera error un 404 o un 500: por eso se devuelve response.ok
// y quien llama decide qué hacer.
async function request(url, options) {
  setLoading(true);
  try {
    const response = await fetch(url, options);
    let body = null;
    if (response.status !== 204) {
      try {
        body = await response.json();
      } catch (e) {
        body = null;
      }
    }
    return { ok: response.ok, status: response.status, body: body };
  } finally {
    setLoading(false);
  }
}

function showStatus(message, isError) {
  statusEl.textContent = message;
  statusEl.className = isError ? "status error" : "status";
}

function describeError(result, fallback) {
  if (result.status === 404) {
    return "La receta no existe (puede que ya se haya eliminado).";
  }
  if (result.body && result.body.error) {
    return fallback + ": " + result.body.error;
  }
  return fallback + " (error " + result.status + ").";
}

function jsonOptions(method, payload) {
  return {
    method: method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  };
}

// ---------- Listado ----------

// El servidor hace el filtrado: aquí solo se construye la URL con los parámetros.
function buildQuery() {
  const params = new URLSearchParams();
  const text = searchInput.value.trim();
  if (text !== "") params.set("search", text);
  if (filterCategory.value !== "") params.set("category", filterCategory.value);
  if (filterFavorite.checked) params.set("favorite", "true");
  const query = params.toString();
  return query === "" ? API : API + "?" + query;
}

async function loadRecipes() {
  const myLoad = ++loadCounter;
  try {
    const result = await request(buildQuery());
    if (myLoad !== loadCounter) return; // ya hay una consulta más reciente
    if (!result.ok) {
      listEl.textContent = "";
      showStatus("No se pudieron cargar las recetas (error " + result.status + ").", true);
      return;
    }
    renderList(result.body);
  } catch (error) {
    if (myLoad !== loadCounter) return;
    listEl.textContent = "";
    showStatus(CONNECTION_ERROR, true);
  }
}

function renderList(recipes) {
  listEl.textContent = "";
  if (recipes.length === 0) {
    showStatus("No hay recetas que coincidan. Cambia los filtros o crea una nueva.", false);
    return;
  }
  showStatus("", false);
  recipes.forEach(function (recipe) {
    listEl.appendChild(buildRecipeItem(recipe));
  });
}

function makeButton(text, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  if (className !== "") button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

// Se construye con createElement y textContent (no con innerHTML):
// así un título con etiquetas HTML se muestra como texto y no se ejecuta.
function buildRecipeItem(recipe) {
  const li = document.createElement("li");
  li.className = "recipe";

  const info = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = recipe.title;
  const details = document.createElement("p");
  details.textContent =
    recipe.minutes + " min · " + CATEGORY_LABELS[recipe.category] + (recipe.favorite ? " · ★ Favorita" : "");
  info.appendChild(title);
  info.appendChild(details);

  const actions = document.createElement("div");
  actions.className = "recipe-actions";
  actions.appendChild(
    makeButton(
      recipe.favorite ? "★ Quitar favorita" : "☆ Favorita",
      recipe.favorite ? "favorite-on" : "",
      function () {
        toggleFavorite(recipe);
      }
    )
  );
  actions.appendChild(
    makeButton("Editar", "", function () {
      startEdit(recipe);
    })
  );
  actions.appendChild(
    makeButton("Eliminar", "danger", function () {
      removeRecipe(recipe);
    })
  );

  li.appendChild(info);
  li.appendChild(actions);
  return li;
}

// ---------- Acciones sobre una receta ----------

// PATCH: solo cambia el campo favorite y deja el resto como está.
async function toggleFavorite(recipe) {
  try {
    const result = await request(API + "/" + recipe.id, jsonOptions("PATCH", { favorite: !recipe.favorite }));
    if (!result.ok) {
      if (result.status === 404) await loadRecipes();
      showStatus(describeError(result, "No se pudo actualizar la receta"), true);
      return;
    }
    await loadRecipes();
  } catch (error) {
    showStatus(CONNECTION_ERROR, true);
  }
}

async function removeRecipe(recipe) {
  if (!window.confirm("¿Eliminar la receta \"" + recipe.title + "\"?")) return;
  try {
    const result = await request(API + "/" + recipe.id, { method: "DELETE" });
    if (!result.ok) {
      if (result.status === 404) await loadRecipes();
      showStatus(describeError(result, "No se pudo eliminar la receta"), true);
      return;
    }
    if (editingId === recipe.id) resetForm();
    await loadRecipes();
  } catch (error) {
    showStatus(CONNECTION_ERROR, true);
  }
}

// ---------- Formulario ----------

function clearFieldErrors() {
  FIELDS.forEach(function (field) {
    document.getElementById("error-" + field).textContent = "";
  });
}

// Pinta cada error junto a su campo. Lo que no corresponde a un campo
// (por ejemplo "body") va al mensaje general del formulario.
function showFieldErrors(errors) {
  const general = [];
  errors.forEach(function (e) {
    if (FIELDS.includes(e.field)) {
      const target = document.getElementById("error-" + e.field);
      target.textContent = target.textContent === "" ? e.message : target.textContent + " " + e.message;
    } else {
      general.push(e.message);
    }
  });
  if (general.length > 0) formMessage.textContent = general.join(" ");
}

function readForm() {
  return {
    title: inputs.title.value.trim(),
    minutes: inputs.minutes.value === "" ? null : Number(inputs.minutes.value),
    category: inputs.category.value,
    favorite: inputs.favorite.checked,
  };
}

// Validación inicial en el cliente: solo comprobaciones rápidas (obligatorios).
// El rango de minutos y el resto de reglas las decide el servidor.
function validateClient(values) {
  const errors = [];
  if (values.title === "") {
    errors.push({ field: "title", message: "El título es obligatorio." });
  }
  if (values.minutes === null || Number.isNaN(values.minutes)) {
    errors.push({ field: "minutes", message: "Escribe los minutos." });
  }
  if (values.category === "") {
    errors.push({ field: "category", message: "Elige una categoría." });
  }
  return errors;
}

function resetForm() {
  editingId = null;
  form.reset();
  clearFieldErrors();
  formTitle.textContent = "Nueva receta";
  submitBtn.textContent = "Guardar receta";
  cancelBtn.hidden = true;
}

function startEdit(recipe) {
  editingId = recipe.id;
  clearFieldErrors();
  formMessage.textContent = "";
  inputs.title.value = recipe.title;
  inputs.minutes.value = recipe.minutes;
  inputs.category.value = recipe.category;
  inputs.favorite.checked = recipe.favorite;
  formTitle.textContent = "Editar receta";
  submitBtn.textContent = "Guardar cambios";
  cancelBtn.hidden = false;
  form.scrollIntoView({ behavior: "smooth" });
  inputs.title.focus();
}

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  clearFieldErrors();
  formMessage.textContent = "";

  const values = readForm();
  const clientErrors = validateClient(values);
  if (clientErrors.length > 0) {
    showFieldErrors(clientErrors);
    return;
  }

  const isEdit = editingId !== null;
  const url = isEdit ? API + "/" + editingId : API;
  submitBtn.disabled = true;
  try {
    // La edición usa PUT: el formulario envía la receta completa.
    const result = await request(url, jsonOptions(isEdit ? "PUT" : "POST", values));
    if (result.status === 400 && result.body && Array.isArray(result.body.errors)) {
      showFieldErrors(result.body.errors);
      return;
    }
    if (!result.ok) {
      formMessage.textContent = describeError(result, "No se pudo guardar la receta");
      return;
    }
    resetForm();
    formMessage.textContent = isEdit ? "Receta actualizada." : "Receta creada.";
    await loadRecipes();
  } catch (error) {
    formMessage.textContent = CONNECTION_ERROR;
  } finally {
    submitBtn.disabled = false;
  }
});

cancelBtn.addEventListener("click", function () {
  resetForm();
  formMessage.textContent = "";
});

// ---------- Buscador y filtros ----------

searchInput.addEventListener("input", function () {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadRecipes, 300); // espera a que se deje de escribir
});
filterCategory.addEventListener("change", loadRecipes);
filterFavorite.addEventListener("change", loadRecipes);
document.getElementById("filters").addEventListener("submit", function (event) {
  event.preventDefault();
});

loadRecipes();