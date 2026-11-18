/*
  src/controllers/authController.js
  register y login. La factoría recibe usersModel para poder probarla con un fake.
  bcryptjs da la API de bcrypt sin compilar. Se rechazan contraseñas de más de
  72 bytes UTF-8 para evitar que bcrypt las trunque en silencio.
*/

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validCredentials(email, password) {
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) return false;
  if (typeof password !== "string") return false;
  if (password.length < 8) return false;
  if (Buffer.byteLength(password, "utf8") > 72) return false;
  return true;
}

function createAuthController({ usersModel }) {
  return {
    async register(req, res, next) {
      try {
        const { email, password } = req.body || {};
        if (!validCredentials(email, password)) {
          return res.status(400).json({
            error: "Valid email and a password of 8 to 72 bytes are required",
          });
        }
        const cleanEmail = email.trim().toLowerCase();

        if (await usersModel.findByEmail(cleanEmail)) {
          return res.status(409).json({ error: "Email already registered" });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await usersModel.create({ email: cleanEmail, passwordHash });
        return res.status(201).json({ id: user.id, email: user.email });
      } catch (err) {
        // Dos registros a la vez: la restricción UNIQUE de la base de datos
        if (err && err.code === "23505") {
          return res.status(409).json({ error: "Email already registered" });
        }
        next(err);
      }
    },

    async login(req, res, next) {
      try {
        const { email, password } = req.body || {};
        if (!validCredentials(email, password)) {
          return res.status(400).json({
            error: "Valid email and a password of 8 to 72 bytes are required",
          });
        }

        const user = await usersModel.findByEmail(email.trim().toLowerCase());
        if (!user) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, {
          expiresIn: "1h",
        });
        return res.status(200).json({ token });
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = { createAuthController };
