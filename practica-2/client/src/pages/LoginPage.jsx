import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Si ya hay sesión (o se acaba de iniciar), vuelve a donde se iba
  if (user) return <Navigate to={location.state?.from?.pathname ?? "/"} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.status === 401 ? "Correo o contraseña incorrectos." : err.message);
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Iniciar sesión</h1>
      <form onSubmit={handleSubmit} className="form" noValidate>
        {error && <p className="alert" role="alert">{error}</p>}
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" type="email" autoComplete="username" value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <p className="hint">Demostración local: ana@example.com / Demo1234</p>
    </section>
  );
}
