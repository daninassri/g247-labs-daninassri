import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listRecipes, getStats } from "../api/client.js";
import { useApi } from "../hooks/useApi.js";
import { useAuth } from "../auth/AuthContext.jsx";

const PAGE_SIZE = 10;
const SEARCH_DELAY_MS = 400;

const CATEGORIES = [
  { value: "entrante", label: "Entrante" },
  { value: "principal", label: "Principal" },
  { value: "postre", label: "Postre" },
  { value: "vegetariano", label: "Vegetariano" },
  { value: "rapida", label: "Rápida" },
];

const SORT_OPTIONS = [
  { value: "recientes", label: "Más recientes", sort: "id", order: "desc" },
  { value: "titulo", label: "Título (A-Z)", sort: "title", order: "asc" },
  { value: "rapidas", label: "Más rápidas", sort: "minutes", order: "asc" },
  { value: "largas", label: "Más largas", sort: "minutes", order: "desc" },
];
const DEFAULT_SORT = SORT_OPTIONS[0];

const numberFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** Lee y valida el estado de la URL. Los valores no válidos se ignoran. */
function readFilters(searchParams) {
  const category = searchParams.get("category");
  const sortValue = searchParams.get("sort");
  const page = Number.parseInt(searchParams.get("page") ?? "", 10);

  return {
    search: (searchParams.get("q") ?? "").trim(),
    category: CATEGORIES.some((c) => c.value === category) ? category : "",
    favorite: searchParams.get("favorite") === "1",
    mine: searchParams.get("mine") === "1",
    sort: SORT_OPTIONS.find((o) => o.value === sortValue) ?? DEFAULT_SORT,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function errorText(error) {
  if (error?.status === 0) {
    return "No se ha podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.";
  }
  return error?.message || "Ha ocurrido un error inesperado.";
}

export default function RecipeListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();

  const { search, category, favorite, sort, page, ...rest } = readFilters(searchParams);
  // "Solo las mías" solo tiene efecto si hay sesión.
  const mine = rest.mine && Boolean(user);
  const userId = mine ? user.id : undefined;
  const hasFilters = Boolean(search || category || favorite || mine);

  /* ---------- Escritura en la URL ---------- */

  const updateParams = useCallback(
    (changes, { resetPage = true, replace = false } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === "" || value == null || value === false) next.delete(key);
            else next.set(key, String(value));
          }
          if (resetPage) next.delete("page");
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  /* ---------- Búsqueda con debounce ---------- */

  const [searchInput, setSearchInput] = useState(search);
  const lastCommittedSearch = useRef(search);

  // Si la URL cambia desde fuera (atrás/adelante, quitar filtros), sincroniza el campo.
  useEffect(() => {
    if (search !== lastCommittedSearch.current) {
      lastCommittedSearch.current = search;
      setSearchInput(search);
    }
  }, [search]);

  // Aplica la búsqueda a la URL cuando el usuario deja de escribir.
  useEffect(() => {
    const value = searchInput.trim();
    if (value === lastCommittedSearch.current) return undefined;
    const timer = setTimeout(() => {
      lastCommittedSearch.current = value;
      updateParams({ q: value }, { replace: true });
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, updateParams]);

  function handleSubmit(event) {
    event.preventDefault();
    const value = searchInput.trim();
    if (value !== lastCommittedSearch.current) {
      lastCommittedSearch.current = value;
      updateParams({ q: value });
    }
  }

  function clearFilters() {
    lastCommittedSearch.current = "";
    setSearchInput("");
    setSearchParams((prev) => {
      const next = new URLSearchParams();
      const currentSort = prev.get("sort");
      if (currentSort) next.set("sort", currentSort); // la ordenación no es un filtro
      return next;
    });
  }

  /* ---------- Paginación y foco ---------- */

  const resultsHeadingRef = useRef(null);
  const focusResultsAfterLoad = useRef(false);

  function goToPage(target) {
    focusResultsAfterLoad.current = true;
    updateParams({ page: target > 1 ? target : "" }, { resetPage: false });
  }

  /* ---------- Datos ---------- */

  const list = useApi(
    () =>
      listRecipes({
        search: search || undefined,
        category: category || undefined,
        favorite: favorite || undefined,
        userId,
        sort: sort.sort,
        order: sort.order,
        page,
        limit: PAGE_SIZE,
      }),
    [search, category, favorite, userId, sort.value, page]
  );

  const stats = useApi(() => getStats(), []);

  useEffect(() => {
    if (focusResultsAfterLoad.current && !list.loading) {
      focusResultsAfterLoad.current = false;
      resultsHeadingRef.current?.focus();
    }
  }, [list.loading, page]);

  /* ---------- Estado de la vista ---------- */

  const total = list.data?.total ?? 0;
  const items = list.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isUpdating = list.loading && list.data !== null;

  let view;
  if (list.error && !list.loading) view = "error";
  else if (list.data === null) view = "loading";
  else if (total === 0 && !list.loading) view = "empty";
  else if (!list.loading && page > totalPages) view = "out-of-range";
  else view = "success";

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = from + items.length - 1;

  let statusMessage = "";
  if (view === "loading") statusMessage = "Cargando recetas…";
  else if (isUpdating) statusMessage = "Actualizando resultados…";
  else if (view === "empty")
    statusMessage = hasFilters
      ? "No hay recetas que coincidan con los filtros."
      : "Todavía no hay recetas.";
  else if (view === "out-of-range")
    statusMessage = `La página ${page} no existe. Hay ${totalPages} ${totalPages === 1 ? "página" : "páginas"}.`;
  else if (view === "success")
    statusMessage = `Mostrando ${from}–${to} de ${total} ${total === 1 ? "receta" : "recetas"}. Página ${page} de ${totalPages}.`;

  /* ---------- Render ---------- */

  return (
    <main>
      <h1>Recetas</h1>

      {/* Resumen */}
      <section aria-labelledby="stats-title">
        <h2 id="stats-title">Resumen</h2>
        {stats.error && !stats.loading ? (
          <div className="alert" role="alert">
            <p>No se ha podido cargar el resumen. {errorText(stats.error)}</p>
            <button type="button" className="link-button" onClick={stats.reload}>
              Reintentar
            </button>
          </div>
        ) : stats.data === null ? (
          <p role="status">Cargando resumen…</p>
        ) : (
          <dl className="stats">
            <div>
              <dt>Recetas</dt>
              <dd>{numberFormat.format(stats.data.total)}</dd>
            </div>
            <div>
              <dt>Favoritas</dt>
              <dd>{numberFormat.format(stats.data.favorites)}</dd>
            </div>
            <div>
              <dt>Media de minutos</dt>
              <dd>{numberFormat.format(stats.data.averageMinutes ?? 0)} min</dd>
            </div>
          </dl>
        )}
      </section>

      {/* Filtros */}
      <form
        className="filters"
        role="search"
        aria-label="Filtrar recetas"
        onSubmit={handleSubmit}
      >
        <div className="field">
          <label htmlFor="recipe-search">Buscar por título</label>
          <input
            id="recipe-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="field">
          <label htmlFor="recipe-category">Categoría</label>
          <select
            id="recipe-category"
            value={category}
            onChange={(e) => updateParams({ category: e.target.value })}
          >
            <option value="">Todas</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="recipe-sort">Ordenar por</label>
          <select
            id="recipe-sort"
            value={sort.value}
            onChange={(e) =>
              updateParams({ sort: e.target.value === DEFAULT_SORT.value ? "" : e.target.value })
            }
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field-check">
          <input
            id="recipe-favorite"
            type="checkbox"
            checked={favorite}
            onChange={(e) => updateParams({ favorite: e.target.checked ? "1" : "" })}
          />
          <label htmlFor="recipe-favorite">Solo favoritas</label>
        </div>

        {user && (
          <div className="field-check">
            <input
              id="recipe-mine"
              type="checkbox"
              checked={mine}
              onChange={(e) => updateParams({ mine: e.target.checked ? "1" : "" })}
            />
            <label htmlFor="recipe-mine">Solo las mías</label>
          </div>
        )}

        <button type="submit" className="btn">
          Buscar
        </button>
        {hasFilters && (
          <button type="button" className="btn btn-secondary" onClick={clearFilters}>
            Quitar filtros
          </button>
        )}
      </form>

      {/* Resultados */}
      <section aria-labelledby="results-title" aria-busy={list.loading}>
        <h2 id="results-title" ref={resultsHeadingRef} tabIndex={-1}>
          Resultados
        </h2>

        {/* Región viva siempre montada para que los cambios se anuncien */}
        <p role="status">{statusMessage}</p>

        {view === "error" && (
          <div className="alert" role="alert">
            <p>No se han podido cargar las recetas. {errorText(list.error)}</p>
            <button type="button" className="btn" onClick={list.reload}>
              Reintentar
            </button>
          </div>
        )}

        {view === "empty" && (
          <div className="empty">
            {hasFilters ? (
              <>
                <p>Prueba con otra búsqueda o quita los filtros.</p>
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  Quitar filtros
                </button>
              </>
            ) : (
              <p>Cuando se añadan recetas, aparecerán aquí.</p>
            )}
          </div>
        )}

        {view === "out-of-range" && (
          <div className="empty">
            <button type="button" className="btn" onClick={() => goToPage(totalPages)}>
              Ir a la última página ({totalPages})
            </button>{" "}
            <button type="button" className="btn btn-secondary" onClick={() => goToPage(1)}>
              Ir a la primera página
            </button>
          </div>
        )}

        {view === "success" && (
          <>
            <ul className="recipe-list">
              {items.map((recipe) => (
                <li key={recipe.id} className="recipe-card">
                  <h3 className="recipe-title">
                    <Link to={`/recipes/${recipe.id}`}>{recipe.title}</Link>
                  </h3>
                  <p>
                    <span className="badge">{categoryLabel(recipe.category)}</span>{" "}
                    <span>{recipe.minutes} min</span>{" "}
                    {recipe.favorite && (
                      <span className="star" role="img" aria-label="Favorita" title="Favorita">
                        ★
                      </span>
                    )}
                  </p>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <nav className="pagination" aria-label="Paginación de recetas">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || list.loading}
                >
                  Anterior
                </button>
                <span>
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || list.loading}
                >
                  Siguiente
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </main>
  );
}