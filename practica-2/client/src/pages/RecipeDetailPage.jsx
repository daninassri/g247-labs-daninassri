// Detalle: vuelve a consultar cuando cambia el id de la ruta.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteRecipe, getRecipe } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { useApi } from "../hooks/useApi.js";

export default function RecipeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(() => getRecipe(id), [id]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Mientras llega la receta nueva no se enseña la anterior
  const recipe = data && String(data.id) === id ? data : null;

  if (error) {
    return error.status === 404 ? (
      <section>
        <h1>Receta no encontrada</h1>
        <p>No existe ninguna receta con ese identificador.</p>
        <Link to="/">Volver al listado</Link>
      </section>
    ) : (
      <div className="alert" role="alert">
        <p>No se pudo cargar la receta: {error.message}</p>
        <button type="button" className="btn" onClick={reload}>Reintentar</button>
      </div>
    );
  }
  if (loading || !recipe) return <p role="status">Cargando receta...</p>;

  const canEdit = user && (user.role === "admin" || user.id === recipe.userId);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRecipe(id);
      navigate("/", { replace: true });
    } catch (err) {
      setDeleteError(err.message);
      setDeleting(false);
    }
  }

  return (
    <section>
      <p><Link to="/">← Volver al listado</Link></p>
      <h1>{recipe.title} {recipe.favorite && <span className="star" aria-label="Favorita">★</span>}</h1>
      <dl className="details">
        <dt>Categoría</dt>
        <dd>{recipe.category}</dd>
        <dt>Tiempo</dt>
        <dd>{recipe.minutes} minutos</dd>
        <dt>Autor</dt>
        <dd>Usuario {recipe.userId}</dd>
      </dl>

      {canEdit && (
        <div className="actions">
          <Link to={"/recipes/" + recipe.id + "/edit"} className="btn">Editar</Link>
          {!confirming ? (
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Eliminar</button>
          ) : (
            <span className="confirm" role="group" aria-label="Confirmar borrado">
              ¿Seguro?
              <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Eliminando..." : "Sí, eliminar"}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={deleting}>
                Cancelar
              </button>
            </span>
          )}
        </div>
      )}
      {deleteError && <p className="alert" role="alert">{deleteError}</p>}
    </section>
  );
}
