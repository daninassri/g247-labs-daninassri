import { useNavigate } from "react-router-dom";
import { createRecipe } from "../api/client.js";
import RecipeForm from "../components/RecipeForm.jsx";

export default function RecipeNewPage() {
  const navigate = useNavigate();

  async function handleSubmit(body) {
    const created = await createRecipe(body);
    navigate("/recipes/" + created.id);
  }

  return (
    <section>
      <h1>Nueva receta</h1>
      <RecipeForm submitLabel="Crear receta" onSubmit={handleSubmit} />
    </section>
  );
}
