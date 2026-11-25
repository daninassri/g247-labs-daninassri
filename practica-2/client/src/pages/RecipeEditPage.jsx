import { Link, useNavigate, useParams } from "react-router-dom";
import { getRecipe, replaceRecipe } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import RecipeForm from "../components/RecipeForm.jsx";
import { useApi } from "../hooks/useApi.js";

export default function RecipeEditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApi(() => getRecipe(id), [id]);
  const recipe = data && String(data.id) === id ? data : null;

  if (error) {
    return error.status === 404 ? (
      <section>
        <h1>Receta no encontrada</h1>
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

  if (user.role !== "admin" && user.id !== recipe.userId) {
    return (
      <section>
        <h1>Sin permiso</h1>
        <p>Solo el autor o un administrador pueden editar esta receta.</p>
        <Link to={"/recipes/" + recipe.id}>Volver a la receta</Link>
      </section>
    );
  }

  async function handleSubmit(body) {
    await replaceRecipe(id, body);
    navigate("/recipes/" + id);
  }

  return (
    <section>
      <h1>Editar receta</h1>
      <RecipeForm key={recipe.id} initial={recipe} submitLabel="Guardar cambios" onSubmit={handleSubmit} />
    </section>
  );
}
