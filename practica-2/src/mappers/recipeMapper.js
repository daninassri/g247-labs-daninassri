// Mapper: la fila de PostgreSQL usa user_id; el contrato HTTP usa userId.
function toRecipeDTO(row) {
  return {
    id: row.id,
    title: row.title,
    minutes: row.minutes,
    favorite: row.favorite,
    category: row.category,
    userId: row.user_id,
  };
}

module.exports = { toRecipeDTO };
