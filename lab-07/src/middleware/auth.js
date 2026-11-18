/*
  src/middleware/auth.js
  AUTENTICACIÓN: demuestra QUIÉN es quien llama. Verifica el JWT y deja el
  payload en req.user. No decide qué puede hacer: eso es AUTORIZACIÓN y vive
  en los controladores (el 403 de propiedad).
*/

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { auth };
