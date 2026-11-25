// authenticate: exige "Authorization: Bearer <token>" y deja req.user = { id, role }.
// Sin token o con un token inválido o caducado responde 401.
const jwt = require("jsonwebtoken");

function getSecret() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  return process.env.JWT_SECRET;
}

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, getSecret(), {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const payload = jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
    req.user = { id: Number(payload.sub), role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { authenticate, signToken };
