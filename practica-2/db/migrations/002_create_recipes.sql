-- 002: recetas. Cada receta pertenece a un usuario (clave foránea user_id).
CREATE TABLE IF NOT EXISTS recipes (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL CHECK (btrim(title) <> ''),
  minutes    INT NOT NULL CHECK (minutes BETWEEN 1 AND 600),
  favorite   BOOLEAN NOT NULL DEFAULT FALSE,
  category   TEXT NOT NULL CHECK (category IN ('entrante', 'principal', 'postre', 'vegetariano', 'rapida')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recipes_user_id_idx ON recipes (user_id);
