/*
  src/routes/auth.js
  Rutas PÚBLICAS (sin middleware auth): así se consigue el primer token.
  Montadas en app.js como: app.use("/auth", buildAuthRouter(authController)).
*/

const express = require("express");

function buildAuthRouter(authController) {
  const router = express.Router();

  router.post("/register", authController.register);
  router.post("/login", authController.login);

  return router;
}

module.exports = { buildAuthRouter };
