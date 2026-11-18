/*
  src/routes/tasks.js
  Router detrás del middleware auth (app.use("/tasks", auth, ...)), así que
  req.user ya existe en todos los manejadores. Las rutas de escritura pasan
  por el validador Zod.
*/

const express = require("express");
const { taskSchema, validate } = require("../validators/taskSchema");

function buildTasksRouter(tasksController) {
  const router = express.Router();

  router.get("/", tasksController.list);
  router.get("/:id", tasksController.getOne);
  router.post("/", validate(taskSchema), tasksController.create);
  router.put("/:id", validate(taskSchema), tasksController.update);
  router.delete("/:id", tasksController.remove);

  return router;
}

module.exports = { buildTasksRouter };
