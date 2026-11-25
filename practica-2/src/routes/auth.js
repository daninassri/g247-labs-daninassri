// Rutas de autenticación. register y login son públicas; me exige token.
const express = require("express");
const { validate } = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { registerSchema, loginSchema } = require("../validators/schemas");

function buildAuthRouter(authController) {
  const router = express.Router();
  router.post("/register", validate(registerSchema), authController.register);
  router.post("/login", validate(loginSchema), authController.login);
  router.get("/me", authenticate, authController.me);
  return router;
}

module.exports = { buildAuthRouter };
