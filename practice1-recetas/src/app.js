const path = require("path");
const express = require("express");
const logger = require("./middleware/logger");
const recipesRouter = require("./routes/recipes");

const app = express();

app.use(express.json());
app.use(logger);

// Sirve la carpeta public/ (el cliente web) desde el mismo origen que la API.
// Va antes de las rutas de la API, y así la página y los fetch comparten origen.
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/recipes", recipesRouter);

// Ruta no encontrada: 404 en JSON
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Manejador de errores: siempre el último. Responde JSON y no envía trazas al cliente.
app.use((err, req, res, next) => {
  console.error(err.message);
  const status = err.status || 500;
  const message = status === 500 ? "Server error" : "Bad request";
  res.status(status).json({ error: message });
});

module.exports = app;