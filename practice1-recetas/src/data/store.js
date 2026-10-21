// Almacén en memoria de recetas.
// Es el ÚNICO módulo que toca el array: el controlador solo usa estas funciones.
// Para cambiar a una base de datos habría que reescribir este fichero y nada más.

let recipes = [
  { id: 1, title: "Tortilla de patatas", minutes: 45, favorite: true, category: "principal" },
  { id: 2, title: "Gazpacho andaluz", minutes: 15, favorite: false, category: "entrante" },
  { id: 3, title: "Paella valenciana", minutes: 90, favorite: true, category: "principal" },
  { id: 4, title: "Crema catalana", minutes: 30, favorite: false, category: "postre" },
  { id: 5, title: "Ensalada de garbanzos", minutes: 20, favorite: false, category: "vegetariano" },
  { id: 6, title: "Tostada con tomate", minutes: 5, favorite: true, category: "rapida" },
];
let nextId = 7;

function findAll() {
  return [...recipes];
}

function findById(id) {
  return recipes.find((r) => r.id === id);
}

function create(data) {
  const recipe = { ...data, id: nextId++ };
  recipes.push(recipe);
  return recipe;
}

function replace(id, data) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return undefined;
  recipes[index] = { ...data, id };
  return recipes[index];
}

function update(id, changes) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return undefined;
  recipes[index] = { ...recipes[index], ...changes, id };
  return recipes[index];
}

function remove(id) {
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return false;
  recipes.splice(index, 1);
  return true;
}

module.exports = { findAll, findById, create, replace, update, remove };