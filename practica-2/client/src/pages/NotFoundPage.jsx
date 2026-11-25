import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section>
      <h1>Página no encontrada</h1>
      <p>La dirección que has abierto no existe.</p>
      <Link to="/">Volver al inicio</Link>
    </section>
  );
}
