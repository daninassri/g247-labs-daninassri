import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El cliente llama a /api/...; Vite lo reenvía a la API en el puerto 3000 quitando /api.
// Así no hace falta CORS y las rutas del cliente (/recipes/3) no chocan con las de la API.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
