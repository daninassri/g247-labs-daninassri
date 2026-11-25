// register y login. Las contraseñas se guardan con bcrypt (coste 10).
const bcrypt = require("bcryptjs");
const { signToken } = require("../middleware/auth");

function createAuthController({ usersModel }) {
  return {
    // POST /auth/register: siempre crea usuarios ordinarios (role = 'user')
    async register(req, res) {
      const { email, password } = req.valid.body;
      if (await usersModel.findByEmail(email)) {
        return res.status(409).json({ error: "Email already registered" });
      }
      try {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await usersModel.create({ email, passwordHash });
        res.status(201).json({ id: user.id, email: user.email });
      } catch (err) {
        // Dos registros a la vez: salta la restricción UNIQUE
        if (err && err.code === "23505") {
          return res.status(409).json({ error: "Email already registered" });
        }
        throw err;
      }
    },

    // POST /auth/login: 200 con token; cualquier credencial incorrecta, 401
    async login(req, res) {
      const { email, password } = req.valid.body;
      const invalid = () => res.status(401).json({ error: "Invalid credentials" });

      // bcrypt solo mira 72 bytes: una contraseña más larga no puede ser válida
      if (Buffer.byteLength(password, "utf8") > 72) return invalid();

      const user = await usersModel.findByEmail(email.trim().toLowerCase());
      if (!user) return invalid();
      if (!(await bcrypt.compare(password, user.password_hash))) return invalid();

      res.status(200).json({ token: signToken(user) });
    },

    // GET /auth/me: quién es el dueño del token (sirve para recuperar la sesión)
    async me(req, res) {
      const user = await usersModel.findById(req.user.id);
      if (!user) return res.status(401).json({ error: "Invalid or expired token" });
      res.status(200).json({ id: user.id, email: user.email, role: user.role });
    },
  };
}

module.exports = { createAuthController };
