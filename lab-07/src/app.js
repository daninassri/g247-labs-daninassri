/*
  src/app.js
  Ensambla el modelo del Lab 6 con las rutas y el middleware del Lab 7.
*/
const express = require("express");
const { createTasksModel } = require("./models/tasksModel");
const { createUsersModel } = require("./models/usersModel");
const { createTasksController } = require("./controllers/tasksController");
const { createAuthController } = require("./controllers/authController");
const { buildTasksRouter } = require("./routes/tasks");
const { buildAuthRouter } = require("./routes/auth");
const { auth } = require("./middleware/auth");

function buildApp(db) {
  const app = express();
  app.use(express.json());

  const tasksController = createTasksController({ tasksModel: createTasksModel(db) });
  const authController = createAuthController({ usersModel: createUsersModel(db) });

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/auth", buildAuthRouter(authController));
  app.use("/tasks", auth, buildTasksRouter(tasksController));

  // Ruta inexistente
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));

  // Manejador de errores: siempre el último, sin trazas al cliente
  app.use((err, _req, res, _next) => {
    // Errores del cliente (por ejemplo, JSON mal formado)
    if (err && err.status >= 400 && err.status < 500) {
      return res.status(400).json({ error: "Bad request" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}

module.exports = { buildApp };
