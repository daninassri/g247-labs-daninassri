// Protege creación y edición: sin sesión, redirige al login y recuerda a dónde se iba.
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function ProtectedRoute() {
  const { user, restoring } = useAuth();
  const location = useLocation();

  if (restoring) return <p role="status">Comprobando la sesión...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
