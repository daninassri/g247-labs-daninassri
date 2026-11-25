// Listado: búsqueda, filtros, orden y paginación en el servidor. Usa el total que devuelve la API.
// Los filtros viven en la URL (?search=...&page=2), así que se pueden compartir y recargar.
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getStats, listRecipes } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useApi } from "../hooks/useApi.js";

const CATEGORIES = ["entrante", "principal", "postre", "vegetariano", "rapida"];
const SORTS = [
  { value: "id:desc", label: "Más recientes" },
  { value: "title:asc", label: "Título (A-Z)" },
  { value: "minutes:asc", label: "Más rápidas" },
  { value: "minutes:desc", label: "Más largas" },
];
const LIMIT = 10;

export default function RecipeListPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const search = params.get("search") ?? "";
  const category = params.get("category") ?? "";
  const favorite = params.get("favorite") ?? "";
  const mine = params.get("mine") === "true";
  const sortValue = params.get("sort") ?? "id:desc";
  const page = Math.max(1, Number(params.get("page")) || 1);

  function update(changes, { push = false } = {}) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value === "" || value === false || value == null) next.delete(key);
          else next.set(key, String(value));
        }
        if (!("page" in changes)) next.delete("page"); // cualquier filtro vuelve a la página 1
        return next;
      },
      { replace: !push }
    );
  }

  // Búsqueda con espera de 300 ms para no consultar en cada tecla
  const [searchText, setSearchText] = useState(search);
  useEffect(() => {
    if (searchText.trim() === search) return;
    const timer = setTimeout(() => update({ search: searchText.trim() }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText]);

  const [sort, order] = sortValue.split(":");
  const { data, loading, error, reload } = useApi(
    () =>
      listRecipes({
        search: search || undefined,
        category: category || undefined,
        favorite: favorite || undefined,
        userId: mine && user ? user.id : undefined,
        sort,
        order,
        page,
        limit: LIMIT,
      }),
    [search, category, favorite, mine, user?.id, sortValue, page]
  );
  const stats = useApi(getStats, []);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const hasFilters = Boolean(search || category || favorite || mine);

  let content;
  if (error) {
    content = (
      <div className="alert" role="alert">
        <p>No se pudieron cargar las recetas: {error.message}</p>
        <button type="button" className="btn" onClick={reload}>Reintentar</button>
      </div>
    );
  } else if (loading && !data) {
    content = <p role="status">Cargando recetas...</p>;
  } else if (data.items.length === 0) {
    content =
      data.total === 0 ? (
        <p className="empty">
          No hay recetas con estos filtros.{" "}
          {hasFilters && (
            <button type="button" className="link-button" onClick={() => { setSearchText(""); setParams({}); }}>
              Quitar filtros
            </button>
          )}
        </p>
      ) : (
        <p className="empty">
          Esta página no existe.{" "}
          <button type="button" className="link-button" onClick={() => update({}, { push: true })}>
            Ir a la primera
          </button>
        </p>
      );
  } else {
    content = (
      <>
        <ul className="recipe-list" aria-busy={loading}>
          {data.items.map((recipe) => (
            <li key={recipe.id} className="recipe-card">
              <Link to={"/recipes/" + recipe.id} className="recipe-title">{recipe.title}</Link>
              <span className="badge">{recipe.category}</span>
              <span>{recipe.minutes} min</span>
              {recipe.favorite && <span className="star" title="Favorita" aria-label="Favorita">★</span>}
            </li>
          ))}
        </ul>
        <nav className="pagination" aria-label="Paginación">
          <button type="button" className="btn btn-secondary" disabled={page <= 1}
            onClick={() => update({ page: page - 1 }, { push: true })}>
            Anterior
          </button>
          <span role="status">Página {page} de {totalPages} · {data.total} recetas</span>
          <button type="button" className="btn btn-secondary" disabled={page >= totalPages}
            onClick={() => update({ page: page + 1 }, { push: true })}>
            Siguiente
          </button>
        </nav>
      </>
    );
  }

  return (
    <section>
      <h1>Recetas</h1>

      {stats.data && (
        <p className="stats">
          {stats.data.total} recetas · {stats.data.favorites} favoritas · {String(stats.data.averageMinutes).replace(".", ",")} min de media
        </p>
      )}

      <form className="filters" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="search">Buscar</label>
          <input id="search" type="search" value={searchText} placeholder="Título de la receta"
            onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="category">Categoría</label>
          <select id="category" value={category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">Todas</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Ordenar por</label>
          <select id="sort" value={sortValue} onChange={(e) => update({ sort: e.target.value === "id:desc" ? "" : e.target.value })}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="field field-check">
          <input id="favorite" type="checkbox" checked={favorite === "true"}
            onChange={(e) => update({ favorite: e.target.checked ? "true" : "" })} />
          <label htmlFor="favorite">Solo favoritas</label>
        </div>
        {user && (
          <div className="field field-check">
            <input id="mine" type="checkbox" checked={mine}
              onChange={(e) => update({ mine: e.target.checked ? "true" : "" })} />
            <label htmlFor="mine">Solo las mías</label>
          </div>
        )}
      </form>

      {content}
    </section>
  );
}
