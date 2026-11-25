# Notas de migración — de la API en memoria (P1) a PostgreSQL (P2)

## Cómo se aplican

Desde `practica-2/`, con PostgreSQL activo y `.env` creado a partir de `.env.example`:

```bash
npm run db:migrate   # aplica en orden db/migrations/*.sql
npm run db:seed      # carga db/seed.sql (usuarios y recetas de demostración)
```

- `db/migrate.sh` lee `DATABASE_URL` del entorno o de `.env` y ejecuta cada archivo con `psql -v ON_ERROR_STOP=1`, en orden alfabético (por eso llevan prefijo numérico).
- Las migraciones usan `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`, así que se pueden volver a lanzar sin error.
- `db/seed.sql` **vacía las tablas** (`TRUNCATE ... RESTART IDENTITY CASCADE`) antes de rellenarlas. Se puede repetir para volver a los datos iniciales, pero borra todo lo que haya. Es un script solo para entorno local.

## Migraciones

| Archivo | Qué hace |
|---|---|
| `db/migrations/001_create_users.sql` | Crea `users` (`id`, `email` único, `password_hash`, `role`, `created_at`). |
| `db/migrations/002_create_recipes.sql` | Crea `recipes` con la clave foránea `user_id → users(id)` y el índice `recipes_user_id_idx`. |

## Correspondencia de campos P1 → PostgreSQL

En P1 la receta vivía en un array en memoria, con los campos `id`, `title`, `minutes`, `favorite` y `category`, y no tenía propietario.

| Campo en P1 | Columna en P2 | Tipo y restricciones |
|---|---|---|
| `id` (lo generaba el servidor con un contador) | `id` | `SERIAL PRIMARY KEY`: lo genera la base de datos. |
| `title` | `title` | `TEXT NOT NULL`, con `CHECK (btrim(title) <> '')`: no puede estar vacío ni ser solo espacios. |
| `minutes` | `minutes` | `INT NOT NULL`, con `CHECK (minutes BETWEEN 1 AND 600)`. |
| `favorite` | `favorite` | `BOOLEAN NOT NULL DEFAULT FALSE`. |
| `category` | `category` | `TEXT NOT NULL`, con `CHECK` sobre las cinco categorías (entrante, principal, postre, vegetariano, rapida). |
| — (no existía) | `user_id` | `INT NOT NULL REFERENCES users(id) ON DELETE CASCADE`: propietario de la receta. En la API se expone como `userId`. |
| — (no existía) | `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()`. No se devuelve por la API. |

Las reglas de validación (rango de `minutes`, categorías, título no vacío) están **también** como restricciones de la base de datos, no solo en Zod: una escritura que se salte la API no puede guardar datos inválidos.

Tabla nueva `users`: no existía en P1. El `role` solo admite `user` y `admin` (`CHECK`), tiene `user` por defecto y el registro por la API nunca crea administradores; solo la siembra los crea.

## Datos iniciales

- Los datos de ejemplo de P1 (que estaban en memoria) pasan a `db/seed.sql`, ampliados a **30 recetas repartidas entre 3 usuarios** (`ana` 14, `ben` 12 y `admin` 4), con el fin de cumplir al menos 25 recetas y al menos 2 usuarios.
- Las contraseñas se guardan como hash de bcrypt (coste 10), nunca en claro. Las credenciales de demostración están en el `README.md`.
- Los ids se reinician con `RESTART IDENTITY`, así que tras la siembra las recetas vuelven a numerarse desde 1.

## Qué capas cambian

| Antes (P1) | Ahora (P2) |
|---|---|
| `src/data/store.js` (array en memoria) | `src/models/recipesModel.js` y `usersModel.js`, que reciben la base de datos por inyección (`db.query`) y usan consultas parametrizadas. |
| Validadores escritos a mano | Esquemas Zod en `src/validators/schemas.js` y middleware `validate`. |
| Sin autenticación | Middleware `auth` (JWT) y `ownership` (propietario o admin). |
| Filtrado y paginación en JavaScript sobre el array | Búsqueda, filtros, orden y paginación en SQL, con `COUNT(*)` antes de paginar para el `total`. |

## Decisiones y límites conocidos

- **Orden y paginación**: la columna de ordenación sale de una lista cerrada (nunca se concatena texto del cliente) y se añade `id` como segundo criterio para que el orden sea estable al paginar.
- **Búsqueda literal**: se usa `position(lower(...) in lower(title))` en lugar de `ILIKE`, para que `%` y `_` en la búsqueda se traten como texto y no como comodines.
- **PATCH**: `COALESCE` mantiene el valor actual de los campos no enviados. Ninguno de los campos admite `NULL`, por lo que no hay ambigüedad.
- **Borrado de usuarios**: `ON DELETE CASCADE` borra sus recetas. No hay endpoint para borrar usuarios; se comprobó directamente en la base de datos.
- **Sin migraciones de vuelta atrás**: no hay archivos "down" ni tabla que registre qué migraciones se aplicaron. Funciona porque ahora hay solo dos y son idempotentes; con más cambios habría que añadir esa tabla de control.
- **Collation**: la ordenación por título depende de la collation de la base de datos. En mi entorno es la `C` (por bytes: `Zumo < avena < Árbol`), y no distingue como el español. Queda como mejora conocida.
- **Cómo añadir una migración**: crear `db/migrations/003_<nombre>.sql` con el siguiente número, que sea idempotente, y ejecutar `npm run db:migrate`.