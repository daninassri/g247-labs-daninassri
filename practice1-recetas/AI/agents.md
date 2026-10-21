# Agente tester — Práctica 1

## Configuración

- **Agente:** una conversación nueva de Claude (claude.ai), sin historial, distinta de la conversación en la que se desarrolló la API.
- **Rol:** tester de caja negra. Recibió el contrato de la API y no tuvo acceso a `src/` ni al cliente web.
- **Instrucciones:** los dos mensajes que se le enviaron se redactaron en la conversación de desarrollo y se enviaron sin cambios.

## Mensaje 1: comprobaciones

```
Actúa como tester de caja negra de una API REST. No tienes acceso al código, solo al contrato que te doy abajo. La API está en http://localhost:3000.

Genera comprobaciones HTTP con curl, cada una en su bloque de código y con tres datos: qué comprueba, el comando y el resultado esperado según el contrato (código de estado y forma del cuerpo).

Cubre: el caso correcto y los errores de cada endpoint, la diferencia entre PUT y PATCH, filtros combinados, ordenación, paginación, parámetros de consulta inválidos, campos desconocidos en el cuerpo y un id enviado por el cliente.

Las comprobaciones no deben depender de datos que ya existan: crea los tuyos con POST y usa textos únicos.

Si el contrato no define algo, no lo supongas. Al final, lista esos puntos como "ambigüedades" en vez de inventar el resultado esperado.
```

## Contrato recibido

Es el texto del README de entonces, sin las secciones de implementación (contenido estático, por qué el filtrado se hace en el servidor, el párrafo sobre el cliente web y la frase sobre el orden de `/stats`).

```
## El recurso: receta

| Campo | Tipo | Reglas |
|---|---|---|
| id | número | Lo genera el servidor. Si el cliente envía uno, se ignora. |
| title | texto | Obligatorio. No puede estar vacío. Se recortan los espacios de los extremos. |
| minutes | número | Obligatorio. Entero entre 1 y 600. |
| favorite | booleano | Opcional. Debe ser true o false. Por defecto false. |
| category | texto | Obligatorio. Uno de: entrante, principal, postre, vegetariano, rapida. |

Los campos desconocidos no se guardan. Los datos viven en memoria: hay seis recetas iniciales y se pierden al reiniciar el servidor.

## Endpoints

| Método | Ruta | Parámetros de consulta | Respuesta correcta | Errores |
|---|---|---|---|---|
| GET | /recipes | search, favorite, category, sort, order, limit, offset | 200 y un array | 400 |
| GET | /recipes/stats | ninguno | 200 y un resumen | |
| GET | /recipes/:id | ninguno | 200 y la receta | 404 |
| POST | /recipes | ninguno | 201, cabecera Location y la receta creada | 400 |
| PUT | /recipes/:id | ninguno | 200 y la receta sustituida | 404, 400 |
| PATCH | /recipes/:id | ninguno | 200 y la receta actualizada | 404, 400 |
| DELETE | /recipes/:id | ninguno | 204 sin cuerpo | 404 |

Otras respuestas: una ruta inexistente devuelve 404 con {"error":"Route not found"}; un cuerpo que no es JSON válido devuelve 400 con {"error":"Bad request"}; y un fallo interno devuelve 500 con {"error":"Server error"}, sin enviar trazas al cliente. Un id que no existe, o que no es un número, devuelve 404.

### Consulta de la colección

Los parámetros de GET /recipes se pueden combinar. Primero se filtra, después se ordena y al final se pagina.

| Parámetro | Valores | Efecto |
|---|---|---|
| search | texto | Búsqueda parcial en el título, sin distinguir mayúsculas. |
| favorite | true o false | Filtra por favoritas. |
| category | una de las cinco categorías | Filtra por categoría. |
| sort | id, title, minutes, favorite, category | Campo de ordenación. Por defecto id. |
| order | asc o desc | Sentido de la ordenación. Por defecto asc. |
| limit | entero de 1 a 100 | Número máximo de resultados. Sin él, se devuelven todos. |
| offset | entero de 0 o más | Resultados que se saltan. Por defecto 0. |

### Política de parámetros desconocidos o mal formados

Se rechazan con 400 y la lista completa de incidencias. Se considera mal formado un valor fuera de rango o de tipo incorrecto, y también un parámetro repetido (?limit=1&limit=2). Nunca se ignoran en silencio y nunca detienen el servidor.

### Ejemplos

Crear una receta:

bash
curl -i -X POST http://localhost:3000/recipes -H "Content-Type: application/json" -d '{"title":"Pisto","minutes":40,"category":"vegetariano"}'

Respuesta (201 Created, con la cabecera Location: /recipes/7):

json
{"title":"Pisto","minutes":40,"favorite":false,"category":"vegetariano","id":7}

Cuerpo incorrecto (400): se devuelven todos los errores a la vez.

json
{"errors":[{"field":"title","message":"title is required"},{"field":"minutes","message":"minutes is required"},{"field":"category","message":"category is required"}]}

Consulta combinada: las dos recetas más largas.

bash
curl "http://localhost:3000/recipes?sort=minutes&order=desc&limit=2"

Parámetros incorrectos (400):

bash
curl -i "http://localhost:3000/recipes?limit=abc&sort=color&foo=1"

json
{"errors":[{"field":"foo","message":"unknown query parameter"},{"field":"sort","message":"sort must be one of: id, title, minutes, favorite, category"},{"field":"limit","message":"limit must be an integer between 1 and 100"}]}

Resumen. Con las seis recetas iniciales, GET /recipes/stats devuelve:

json
{"total":6,"favorites":3,"averageMinutes":34.2,"byCategory":{"entrante":1,"principal":2,"postre":1,"vegetariano":1,"rapida":1}}

El resumen se calcula en cada petición y nunca se guarda. 

## PUT y PATCH

    PUT /recipes/:id sustituye la receta completa. Se valida el cuerpo completo y los campos que no se envían vuelven a su valor por defecto (por ejemplo, favorite pasa a false).
    PATCH /recipes/:id actualiza solo los campos recibidos. Se valida solo lo que llega y el resto de la receta queda igual. Un PATCH sin ningún campo válido devuelve 400.```

## Mensaje 2: script

```
Reescribe todas tus comprobaciones como un único script bash. Para cada una, debe imprimir una línea con el nombre de la comprobación, el código de estado esperado y el código real, usando curl -s -o /dev/null -w "%{http_code}". Marca con OK o FALLA si coinciden. Para las comprobaciones que dependan del cuerpo de la respuesta y no solo del código, imprime también el cuerpo recibido. No añadas comprobaciones nuevas ni cambies las que ya hiciste.
```

## Comprobaciones generadas

- **`tester-script.sh`:** 84 comprobaciones en 12 secciones: POST, GET por id, PUT, PATCH, PUT frente a PATCH, DELETE, filtros, ordenación, paginación, parámetros inválidos, `/stats` y respuestas globales.
- **Cómo respondió el agente al pedirle el script:**
  - Mantuvo las comprobaciones y su orden, sin añadir ninguna.
  - Se desvió de lo pedido: en las comprobaciones que dependen del cuerpo lo guarda en un fichero temporal en lugar de usar `/dev/null`. Lo justificó porque, si no, habría que repetir los `POST`, `PUT`, `PATCH` y `DELETE` para leer el cuerpo.
  - Avisó de que seis de sus expectativas fallarían y las dejó como estaban, porque se le había dicho que no las cambiara.
- **Resultados:** `tester-results.txt` (primera ejecución) y `tester-results-2.txt` (tras corregir el id).

## Ambigüedades que listó el agente (20)

1. Cuerpo del 404 por id.
2. Cuerpo del 400 de un `PATCH` sin campos válidos.
3. Mensajes de error de rango y tipo, de `offset`, `favorite`, `category`, `order` y parámetros repetidos.
4. Orden del array `errors`.
5. Título con solo espacios.
6. Mayúsculas en valores enumerados.
7. Conversiones de tipo y `null`.
8. Criterio de ordenación y desempate.
9. Atomicidad de un `PUT` o `PATCH` rechazado.
10. `PATCH` con solo `id`.
11. Precedencia entre 404 y 400.
12. Formato del id en la ruta y reutilización de ids.
13. Valores vacíos en la consulta.
14. Parámetros en endpoints que no los admiten.
15. Otros cuerpos de petición.
16. Método no permitido.
17. Detalles de `/stats`.
18. `Location` relativa o absoluta.
19. Longitud máxima de `title`.
20. El error 500 no se puede provocar desde fuera.