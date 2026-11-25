// Único punto de contacto con la API: añade el token, comprueba la respuesta
// (axios rechaza todo lo que no sea 2xx) y cierra la sesión ante un 401 autenticado.
import axios from "axios";

const TOKEN_KEY = "saborcasero_token";

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // sin almacenamiento disponible: la sesión dura lo que dure la página
  }
}

// Error con el estado HTTP y los errores por campo que devuelve Zod en la API
export class ApiError extends Error {
  constructor(message, status, fieldErrors = {}) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

function toApiError(error) {
  if (!error.response) return new ApiError("No se pudo conectar con el servidor", 0);
  const { status, data } = error.response;
  const fieldErrors = {};
  if (Array.isArray(data?.errors)) {
    data.errors.forEach((e) => {
      if (!fieldErrors[e.field]) fieldErrors[e.field] = e.message;
    });
  }
  const message =
    data?.error || (Object.keys(fieldErrors).length > 0 ? "Revisa los campos marcados" : "Error " + status);
  return new ApiError(message, status, fieldErrors);
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });

let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && !config.skipAuth) config.headers.Authorization = "Bearer " + token;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && hadToken) onUnauthorized();
    return Promise.reject(toApiError(error));
  }
);

// ---------- Autenticación ----------
export const login = (email, password) =>
  api.post("/auth/login", { email, password }, { skipAuth: true }).then((r) => r.data);
export const getMe = () => api.get("/auth/me").then((r) => r.data);

// ---------- Recetas ----------
export const listRecipes = (params) => api.get("/recipes", { params }).then((r) => r.data);
export const getRecipe = (id) => api.get("/recipes/" + id).then((r) => r.data);
export const getStats = () => api.get("/recipes/stats").then((r) => r.data);
export const createRecipe = (body) => api.post("/recipes", body).then((r) => r.data);
export const replaceRecipe = (id, body) => api.put("/recipes/" + id, body).then((r) => r.data);
export const deleteRecipe = (id) => api.delete("/recipes/" + id);
