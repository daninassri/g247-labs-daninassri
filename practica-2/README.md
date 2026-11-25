# SaborCasero — Práctica 2 (full-stack)

Aplicación de recetas con API REST (Node + Express + PostgreSQL), autenticación con JWT y roles, y cliente React (Vite). Es la evolución de la Práctica 1 (API en memoria); ver [Qué cambió respecto a P1](#qué-cambió-respecto-a-p1).

Todo se ejecuta en local. No incluye despliegue, Docker, CI/CD, OAuth, rotación de tokens, recuperación de contraseña, subida de archivos ni un segundo recurso.

## Requisitos

- Node.js 24 o superior (la API usa `node --env-file`).
- PostgreSQL 16 o superior, con el cliente `psql`.
- `bash` y `npm`.

## Arranque desde un clon limpio

Todos los comandos se ejecutan en una terminal Linux o WSL.

```bash
git clone https://github.com/daninassri/g247-labs-daninassri.git
cd g247-labs-daninassri/practica-2
```

**1. PostgreSQL: rol y base de datos**

```bash
sudo -u postgres psql -c "CREATE ROLE saborcasero LOGIN PASSWORD 'saborcasero';"
sudo -u postgres psql -c "CREATE DATABASE saborcasero OWNER saborcasero;"
```

(Si el servicio no está activo: `sudo service postgresql start`.)

**2. Variables de entorno**

```bash
cp .env.example .env
```

| Variable | Qué es | Valor de ejemplo |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL | `postgres://saborcasero:saborcasero@localhost:5432/saborcasero` |
| `JWT_SECRET` | Secreto con el que se firman los tokens | `cambia-este-secreto-en-local` |
| `PORT` | Puerto de la API | `3000` |

`.env` no se sube al repositorio (está en `.gitignore`). La API no arranca si faltan `DATABASE_URL` o `JWT_SECRET`.

**3. Dependencias, migraciones y datos**

```bash
npm install
npm run db:migrate
npm run db:seed
```

Detalles de las migraciones en [`db/migration-notes.md`](db/migration-notes.md).

**4. API** (terminal 1, queda en marcha)

```bash
npm start
```

Escucha en `http://localhost:3000`. Comprobación: `curl http://localhost:3000/health`.

**5. Cliente** (terminal 2, queda en marcha)

```bash
cd client
npm install
npm run dev
```

Abre `http://localhost:5173`. El cliente llama a `/api/...` y Vite lo reenvía a la API en el puerto 3000 (no hace falta CORS). La URL se puede cambiar con `VITE_API_URL` (ver `client/.env.example`).

**Pruebas de la API** (usan la base de datos real y limpian lo que crean):

```bash
npm test
```

## Usuarios de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@example.com` | `Admin1234` |
| Usuario | `ana@example.com` | `Demo1234` |
| Usuario | `ben@example.com` | `Demo1234` |

Los datos iniciales son 30 recetas: `ana` 14, `ben` 12 y `admin` 4. Son credenciales solo para uso local.

## Contrato HTTP

Los errores de validación devuelven `400` con `{"errors":[{"field","message"}, ...]}` (todas las incidencias a la vez). El resto de errores devuelven `{"error":"..."}`.

### El recurso: receta

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | número | Lo genera la base de datos. Si el cliente envía uno, se ignora. |
| `title` | texto | Obligatorio. No vacío. Se recortan los espacios de los extremos. |
| `minutes` | número | Obligatorio. Entero entre 1 y 600. |
| `favorite` | booleano | Opcional (`true` o `false`). Por defecto `false`. |
| `category` | texto | Obligatorio. Una de: `entrante`, `principal`, `postre`, `vegetariano`, `rapida`. |
| `userId` | número | Propietario. Solo aparece en las respuestas. Lo fija el token; si el cliente envía uno, se ignora. |

Los campos desconocidos del cuerpo se descartan. No hay conversión de tipos (`"40"` no es un número válido).

### Autenticación

| Método | Ruta | Cuerpo | Respuesta correcta | Errores |
|---|---|---|---|---|
| POST | `/auth/register` | `email`, `password` | 201 `{"id","email"}` | 400, 409 |
| POST | `/auth/login` | `email`, `password` | 200 `{"token"}` | 400, 401 |
| GET | `/auth/me` | — (cabecera `Authorization`) | 200 `{"id","email","role"}` | 401 |

- Correo con formato válido (se guarda en minúsculas y sin espacios; el duplicado se detecta sin distinguir mayúsculas → 409). Contraseña de 8 caracteres a 72 bytes.
- El registro siempre crea usuarios con rol `user`; si el cuerpo trae un rol, se ignora.
- El token es un JWT (HS256) que caduca a la hora, con `{sub, role}`. Se envía como `Authorization: Bearer <token>`.
- En el acceso, cualquier credencial incorrecta devuelve 401. El 400 solo se devuelve si falta el correo o la contraseña, o no son texto.
- Las contraseñas no se devuelven nunca (se guardan con bcrypt).

### Recetas

Las lecturas son públicas; toda escritura requiere token.

| Método | Ruta | Acceso | Respuesta correcta | Errores |
|---|---|---|---|---|
| GET | `/recipes` | público | 200 `{"page","limit","total","items"}` | 400 |
| GET | `/recipes/stats` | público | 200 `{"total","favorites","averageMinutes","byCategory"}` | |
| GET | `/recipes/:id` | público | 200 la receta | 404 |
| POST | `/recipes` | token | 201, cabecera `Location: /recipes/<id>` y la receta | 400, 401 |
| PUT | `/recipes/:id` | token | 200 la receta sustituida | 400, 401, 403, 404 |
| PATCH | `/recipes/:id` | token | 200 la receta actualizada | 400, 401, 403, 404 |
| DELETE | `/recipes/:id` | token | 204 sin cuerpo | 401, 403, 404 |

**Permisos.** La receta pertenece a quien la creó. Solo su propietario o un administrador pueden modificarla o borrarla; cualquier otro usuario con token válido recibe 403. Sin token, o con token inválido o caducado, 401. El administrador puede editar y borrar cualquiera y el propietario no cambia. Un id que no existe o está mal formado devuelve 404.

**Orden de las comprobaciones** en PUT, PATCH y DELETE: JSON bien formado (400) → token (401) → la receta existe (404) → es suya o es admin (403) → cuerpo válido (400).

**PUT y PATCH.** PUT sustituye la receta entera: lo que no se envía vuelve a su valor por defecto (`favorite` pasa a `false`). PATCH cambia solo lo recibido y valida solo eso; es atómico (si un campo es inválido, no se aplica ninguno) y sin ningún campo válido devuelve 400.

**Resumen.** `/recipes/stats` calcula en SQL el total, las favoritas y la media de minutos (un decimal) sobre todas las recetas visibles. `byCategory` incluye siempre las cinco categorías.

**Otras respuestas.** Ruta o método no definidos: `404 {"error":"Route not found"}`. JSON mal formado: `400 {"error":"Bad request"}`. Fallo interno: `500 {"error":"Server error"}` sin trazas.

### Consulta del listado

Primero se filtra, después se ordena y al final se pagina (todo en PostgreSQL).

| Parámetro | Valores | Efecto |
|---|---|---|
| `search` | texto | Búsqueda parcial en el título, sin distinguir mayúsculas (`%` y `_` se buscan como texto). |
| `favorite` | `true` o `false` | Filtra por favoritas. |
| `category` | una de las cinco | Filtra por categoría. |
| `userId` | entero positivo | Filtra por propietario. |
| `sort` | `id`, `title`, `minutes`, `favorite`, `category` | Campo de ordenación. Por defecto `id`. |
| `order` | `asc` o `desc` | Por defecto `asc`. |
| `page` | entero de 1 a 100000 | Por defecto 1. |
| `limit` | entero de 1 a 100 | Por defecto 10. |

`total` es el número de recetas que cumplen los filtros, contado antes de paginar. Los parámetros desconocidos, mal formados, fuera de rango o repetidos (`?limit=1&limit=2`) se rechazan con 400 y la lista completa de incidencias; nunca se ignoran. Los valores distinguen mayúsculas (`order=DESC` es un error).

### Ejemplos

```bash
# Acceso
curl -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" \
  -d '{"email":"ana@example.com","password":"Demo1234"}'

# Crear una receta (con el token devuelto)
curl -i -X POST http://localhost:3000/recipes -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" -d '{"title":"Pisto","minutes":40,"category":"vegetariano"}'

# Las dos recetas más largas
curl "http://localhost:3000/recipes?sort=minutes&order=desc&limit=2"

# Parámetros incorrectos (400 con todas las incidencias)
curl -i "http://localhost:3000/recipes?limit=abc&sort=color&foo=1"
```

## Cliente (React)

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/` | Listado con búsqueda, filtros, orden y paginación | Público |
| `/recipes/:id` | Detalle (editar y borrar si es suyo o es admin) | Público |
| `/login` | Inicio de sesión | Público |
| `/recipes/new` | Nueva receta | Requiere sesión |
| `/recipes/:id/edit` | Editar receta | Requiere sesión |
| `*` | Página 404 | Público |

- **Sesión**: `AuthContext` guarda el token en `localStorage` y recupera la sesión con `/auth/me`. Las rutas protegidas redirigen a `/login`.
- **Peticiones**: un único módulo (`src/api/client.js`) añade el token, convierte los errores y cierra la sesión ante un 401 con token.
- **Hook reutilizable**: `useApi(fetcher, deps)` devuelve `data`, `loading`, `error` y `reload`, y descarta las respuestas antiguas.
- **Listado**: búsqueda, filtros, orden y página viven en la URL; el número de páginas sale del `total` de la API; la búsqueda espera 400 ms antes de consultar.
- **Estados**: cargando, error con reintento, vacío y éxito en cada pantalla que consulta la API.
- **Formulario**: valida en el servidor con Zod y muestra cada error junto a su campo.
- **Estilos**: una sola hoja global (`src/styles.css`), foco visible y un punto de corte responsive (640 px).

## Estructura

```
practica-2/
├── db/
│   ├── migrations/        001_create_users.sql, 002_create_recipes.sql
│   ├── migrate.sh, seed.sh, seed.sql
│   └── migration-notes.md
├── src/                   app.js, server.js, routes/, controllers/, models/,
│                          mappers/, middleware/, validators/
├── tests/                 api.test.js (node:test + supertest)
├── client/                aplicación React (Vite)
├── AI/                    agentes y registro de revisión (ver abajo)
├── .env.example
└── package.json
```

## Qué cambió respecto a P1

| Aspecto | P1 | P2 |
|---|---|---|
| Almacenamiento | Array en memoria (se perdía al reiniciar) | PostgreSQL con migraciones numeradas y datos iniciales (`db/`) |
| Acceso a datos | `src/data/store.js` | Modelos con la base de datos inyectada y consultas parametrizadas |
| Validación | Validadores propios | Esquemas Zod y middleware `validate`; el formato `{errors:[{field,message}]}` se mantiene |
| Seguridad | Sin autenticación | Registro, acceso, JWT, roles `user`/`admin`, 401/403/404 |
| Listado | `limit` y `offset` | `page` y `limit`; la respuesta pasa a `{page,limit,total,items}`, con `total` calculado antes de paginar |
| Receta | `id`, `title`, `minutes`, `favorite`, `category` | Añade `userId` (propietario) |
| Filtros | `search`, `favorite`, `category`, orden | Añade `userId` |
| Endpoints nuevos | — | `/auth/register`, `/auth/login`, `/auth/me`, `/recipes/stats` |
| Parámetros de consulta inválidos | 400 con todas las incidencias | Se mantiene la misma política |
| Cliente | JavaScript sin framework | React + Vite en `client/` |
| Pruebas | Scripts `curl` | `npm test` contra PostgreSQL real, más los scripts de los agentes (`AI/`) |

### Dónde está P1

La Práctica 1 sigue intacta en la carpeta [`../practice1-recetas/`](../practice1-recetas/) de este mismo repositorio. Sus commits son `185e09e` y `1ffe8d3`.

## Uso de IA

Los dos agentes de esta práctica están descritos en [`AI/agents.md`](AI/agents.md), con sus mensajes y sus resultados. La revisión de lo que propusieron, lo que se aceptó, se corrigió y se descartó (incluido el defecto del agente UX/UI y su commit) está en [`AI/review-log.md`](AI/review-log.md).

- **Agente tester** (API, caja negra): 117 comprobaciones, más 48 adicionales para resolver las ambigüedades del contrato.
- **Agente UX/UI**: propuesta del listado de recetas, revisada contra el proyecto real.

## Limitaciones conocidas

- La ordenación por título usa la collation de la base de datos: con la collation `C` el orden es por bytes y no es el del español.
- No hay endpoint para borrar usuarios ni para registrarse desde el cliente (el registro existe en la API).
- Las migraciones son idempotentes, pero no hay tabla que registre cuáles se han aplicado ni migraciones de vuelta atrás.