import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="site-header">
        <Link to="/" className="brand">SaborCasero</Link>
        <nav aria-label="Principal">
          <NavLink to="/" end>Recetas</NavLink>
          {user && <NavLink to="/recipes/new">Nueva receta</NavLink>}
          {user ? (
            <span className="session">
              <span>{user.email}{user.role === "admin" ? " (admin)" : ""}</span>
              <button type="button" className="btn btn-secondary" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </span>
          ) : (
            <NavLink to="/login">Iniciar sesión</NavLink>
          )}
        </nav>
      </header>
      <main id="contenido">
        <Outlet />
      </main>
    </>
  );
}
