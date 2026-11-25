// Sesión: inicia y cierra sesión, guarda el JWT y lo recupera al recargar (GET /auth/me).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMe, getStoredToken, login as apiLogin, setUnauthorizedHandler, storeToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Si hay un token guardado, hay que comprobarlo antes de decidir si hay sesión
  const [restoring, setRestoring] = useState(() => Boolean(getStoredToken()));

  const logout = useCallback(() => {
    storeToken(null);
    setUser(null);
  }, []);

  // Un 401 en una petición autenticada cierra la sesión
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    if (!getStoredToken()) return;
    let ignore = false;
    getMe()
      .then((me) => {
        if (!ignore) setUser(me);
      })
      .catch(() => {
        if (!ignore) logout();
      })
      .finally(() => {
        if (!ignore) setRestoring(false);
      });
    return () => {
      ignore = true;
    };
  }, [logout]);

  const login = useCallback(async (email, password) => {
    const { token } = await apiLogin(email, password);
    storeToken(token);
    const me = await getMe();
    setUser(me);
    return me;
  }, []);

  const value = useMemo(() => ({ user, restoring, login, logout }), [user, restoring, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
