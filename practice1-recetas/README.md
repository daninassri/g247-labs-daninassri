# SaborCasero — Práctica 1: Foundations API

API REST de recetas con Node.js y Express, y un cliente web en HTML, CSS y JavaScript vanilla que la consume con `fetch`.

## Integrantes y tema

- Daniel Nassri Mawal (GitHub: `daninassri`). Trabajo individual.
- Tema: recetas de cocina. Recurso de dominio: `recipes`.

## Cómo ejecutarlo

Requisitos: Node.js 18 o superior.

```bash
cd practice1-recetas
npm install
npm start
```

- El servidor escucha en `http://localhost:3000` (se puede cambiar con la variable de entorno `PORT`).
- El cliente web se abre en esa misma URL.
- `npm start` usa `node --watch`: el servidor se reinicia al guardar un fichero y, como los datos están en memoria, vuelven a las seis recetas iniciales.
- Esta práctica no incluye pruebas automatizadas (ampliación opcional del enunciado), así que no hay `npm test`.

## Estructura

```text
practice1-recetas/
  package.json
  README.md
  src/
    app.js                         configura Express y exporta la app
    server.js                      abre el puerto
    middleware/logger.js           una línea "METODO URL" por petición
    routes/recipes.js              asocia verbo y ruta con un controlador
    controllers/recipesController.js   decide códigos de estado y respuestas
    data/store.js                  almacén en memoria (único módulo que toca el array)
    validators/recipeValidator.js  validación del cuerpo (completa o parcial)
    validators/recipeQuery.js      validación de los parámetros de consulta
  public/
    index.html
    styles.css
    app.js                         cliente web
  AI/
    agents.md
    review-log.md
```

Las rutas son ligeras, el controlador no accede al array y el almacén está detrás de un módulo sustituible.

## El recurso: receta

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | número | Lo genera el servidor. Si el cliente envía uno, se ignora. |
| `title` | texto | Obligatorio. No puede estar vacío. Se recortan los espacios de los extremos. |
| `minutes` | número | Obligatorio. Entero entre 1 y 600. |
| `favorite` | booleano | Opcional. Debe ser `true` o `false`. Por defecto `false`. |
| `category` | texto | Obligatorio. Uno de: `entrante`, `principal`, `postre`, `vegetariano`, `rapida`. |

Los campos desconocidos no se guardan. Los datos viven en memoria: hay seis recetas iniciales y se pierden al reiniciar el servidor.

## Endpoints

| Método | Ruta | Parámetros de consulta | Respuesta correcta | Errores |
|---|---|---|---|---|
| GET | `/recipes` | `search`, `favorite`, `category`, `sort`, `order`, `limit`, `offset` | `200` y un array | `400` |
| GET | `/recipes/stats` | ninguno | `200` y un resumen | |
| GET | `/recipes/:id` | ninguno | `200` y la receta | `404` |
| POST | `/recipes` | ninguno | `201`, cabecera `Location` y la receta creada | `400` |
| PUT | `/recipes/:id` | ninguno | `200` y la receta sustituida | `404`, `400` |
| PATCH | `/recipes/:id` | ninguno | `200` y la receta actualizada | `404`, `400` |
| DELETE | `/recipes/:id` | ninguno | `204` sin cuerpo | `404` |

Otras respuestas: una ruta inexistente devuelve `404` con `{"error":"Route not found"}`; un cuerpo que no es JSON válido devuelve `400` con `{"error":"Bad request"}`; y un fallo interno devuelve `500` con `{"error":"Server error"}`, sin enviar trazas al cliente. Un `id` que no existe, o que no es un número, devuelve `404`.

### Consulta de la colección

Los parámetros de `GET /recipes` se pueden combinar. Primero se filtra, después se ordena y al final se pagina.

| Parámetro | Valores | Efecto |
|---|---|---|
| `search` | texto | Búsqueda parcial en el título, sin distinguir mayúsculas. |
| `favorite` | `true` o `false` | Filtra por favoritas. |
| `category` | una de las cinco categorías | Filtra por categoría. |
| `sort` | `id`, `title`, `minutes`, `favorite`, `category` | Campo de ordenación. Por defecto `id`. |
| `order` | `asc` o `desc` | Sentido de la ordenación. Por defecto `asc`. |
| `limit` | entero de 1 a 100 | Número máximo de resultados. Sin él, se devuelven todos. |
| `offset` | entero de 0 o más | Resultados que se saltan. Por defecto 0. |

### Política de parámetros desconocidos o mal formados

Se rechazan con `400` y la lista completa de incidencias. Se considera mal formado un valor fuera de rango o de tipo incorrecto, y también un parámetro repetido (`?limit=1&limit=2`). Nunca se ignoran en silencio y nunca detienen el servidor.

### Ejemplos

Crear una receta:

```bash
curl -i -X POST http://localhost:3000/recipes -H "Content-Type: application/json" -d '{"title":"Pisto","minutes":40,"category":"vegetariano"}'
```

Respuesta (`201 Created`, con la cabecera `Location: /recipes/7`):

```json
{"title":"Pisto","minutes":40,"favorite":false,"category":"vegetariano","id":7}
```

Cuerpo incorrecto (`400`): se devuelven todos los errores a la vez.

```json
{"errors":[{"field":"title","message":"title is required"},{"field":"minutes","message":"minutes is required"},{"field":"category","message":"category is required"}]}
```

Consulta combinada: las dos recetas más largas.

```bash
curl "http://localhost:3000/recipes?sort=minutes&order=desc&limit=2"
```

Parámetros incorrectos (`400`):

```bash
curl -i "http://localhost:3000/recipes?limit=abc&sort=color&foo=1"
```

```json
{"errors":[{"field":"foo","message":"unknown query parameter"},{"field":"sort","message":"sort must be one of: id, title, minutes, favorite, category"},{"field":"limit","message":"limit must be an integer between 1 and 100"}]}
```

Resumen. Con las seis recetas iniciales, `GET /recipes/stats` devuelve:

```json
{"total":6,"favorites":3,"averageMinutes":34.2,"byCategory":{"entrante":1,"principal":2,"postre":1,"vegetariano":1,"rapida":1}}
```

El resumen se calcula en cada petición y nunca se guarda. La ruta `/stats` se declara antes de `/:id`; si no, Express leería `stats` como un identificador.

## Contenido estático

`express.static` se instala en `src/app.js`, después de `express.json()` y del logger, y antes de las rutas de la API. Sirve la carpeta `public/`. Así la página y la API comparten origen: el cliente usa rutas relativas como `/recipes` y no hace falta configurar CORS.

## Por qué el filtrado se hace en el servidor

El cliente solo construye la consulta (`?search=...&category=...&favorite=true`) y el servidor devuelve ya la lista filtrada. Así el navegador no descarga toda la colección para descartar la mayoría, la lógica se escribe una sola vez y sirve a cualquier cliente, y la paginación con `limit` y `offset` solo tiene sentido si el filtrado ocurre antes de paginar.

## PUT y PATCH

- `PUT /recipes/:id` sustituye la receta completa. Se valida el cuerpo completo y los campos que no se envían vuelven a su valor por defecto (por ejemplo, `favorite` pasa a `false`).
- `PATCH /recipes/:id` actualiza solo los campos recibidos. Se valida solo lo que llega y el resto de la receta queda igual. Un `PATCH` sin ningún campo válido devuelve `400`.

El cliente usa `PUT` en el formulario de edición, porque envía la receta completa. Usa `PATCH` en el botón de favorita, porque solo cambia un campo.