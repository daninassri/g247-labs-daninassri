// Ensambla la aplicación. Recibe la base de datos (db.query) por inyección.
const express = require("express");
const logger = require("./middleware/logger");
const { createUsersModel } = require("./models/usersModel");
const { createRecipesModel } = require("./models/recipesModel");
const { createAuthController } = require("./controllers/authController");
const { createRecipesController } = require("./controllers/recipesController");
const { buildAuthRouter } = require("./routes/auth");
const { buildRecipesRouter } = require("./routes/recipes");

function buildApp(db, { log = true } = {}) {
  const app = express();

  app.use(express.json());
  if (log) app.use(logger);

  const usersModel = createUsersModel(db);
  const recipesModel = createRecipesModel(db);
  const authController = createAuthController({ usersModel });
  const recipesController = createRecipesController({ recipesModel });

  app.get("/health", (req, res) => res.json({ status: "ok" }));
  app.use("/auth", buildAuthRouter(authController));
  app.use("/recipes", buildRecipesRouter(recipesController, recipesModel));

  // Ruta no encontrada: 404 en JSON
  app.use((req, res) => res.status(404).json({ error: "Route not found" }));

  // Manejador de errores: siempre el último. Sin trazas al cliente.
  app.use((err, req, res, next) => {
    const status = err.status >= 400 && err.status < 500 ? 400 : 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? "Server error" : "Bad request" });
  });

  return app;
}

module.exports = { buildApp };
