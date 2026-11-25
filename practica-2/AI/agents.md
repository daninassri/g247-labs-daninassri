# Agentes de IA — Práctica 2 (SaborCasero)

Esta práctica usa dos agentes de IA, cada uno en una conversación separada de Claude, con una responsabilidad distinta y sin acceso al código del proyecto salvo cuando se indica. Aquí se documenta cómo se definió cada uno. Qué se les pidió, qué se revisó y qué se aceptó o corrigió está en `AI/review-log.md`.

## Agente 1 — Tester de caja negra (API)

### Papel y límites

- Conversación nueva de claude.ai, **sin acceso al código**. Recibe solo el contrato HTTP y la configuración.
- Genera comprobaciones HTTP con `curl` para los endpoints, y después las reescribe como un único script bash con `curl` y `jq`.
- Por diseño no puede conocer los detalles de implementación. Lo que el contrato no define lo lista como "ambigüedad" en lugar de suponerlo.
- Mejoras respecto a P1, a raíz de la corrección del profesor: el script comprueba también el **cuerpo** de las respuestas con `jq`, **borra todo lo que crea** (con `trap` en EXIT, aunque falle una comprobación) y cubre los cuatro perfiles de acceso (anónimo, propietario, otro usuario y administrador).

### Configuración entregada

- URL base: `http://localhost:3000`.
- Usuarios de demostración: `admin@example.com / Admin1234` (rol admin), `ana@example.com / Demo1234` y `ben@example.com / Demo1234` (rol user).
- No existe endpoint para borrar usuarios; el script puede usar `psql` y `DATABASE_URL` para limpiar los que registre.

### Mensaje 1 (instrucciones + configuración + contrato)

Instrucciones:

> Actúa como tester de caja negra de una API REST. No tienes acceso al código, solo al contrato y a la configuración que te doy abajo.
>
> Genera comprobaciones HTTP con curl, cada una en su bloque de código y con tres datos: qué comprueba, el comando y el resultado esperado según el contrato (código de estado y forma y valores del cuerpo).
>
> Cubre: el caso correcto y los errores de cada endpoint; los cuatro perfiles de acceso (anónimo, propietario de una receta, otro usuario que no es el propietario, y administrador); la diferencia entre PUT y PATCH; filtros combinados, ordenación y paginación con su total; parámetros de consulta inválidos; campos desconocidos en el cuerpo; un id o un userId enviados por el cliente en el cuerpo; el registro y el acceso con sus errores; y los tokens ausentes, mal formados o inválidos.
>
> Las comprobaciones no deben depender de recetas que ya existan: crea las tuyas con POST y usa textos únicos. Los únicos datos que puedes dar por existentes son los tres usuarios de demostración de la configuración. Para los demás usuarios, regístralos tú con correos únicos.
>
> Si el contrato no define algo, no lo supongas. Al final, lista esos puntos como "ambigüedades" en vez de inventar el resultado esperado.

Contrato entregado (resumen fiel; el texto completo es el apartado "Contrato HTTP" del `README.md`):

- **Receta**: `id` (lo genera el servidor), `title` (obligatorio, no vacío, se recortan espacios), `minutes` (entero 1–600), `favorite` (booleano, por defecto false), `category` (entrante, principal, postre, vegetariano, rapida), `userId` (solo en respuestas, lo fija el token). Los campos desconocidos no se guardan.
- **Autenticación**: `POST /auth/register` (201, 400, 409), `POST /auth/login` (200 con `{"token"}`, 400, 401), `GET /auth/me` (200, 401). Contraseña de 8 caracteres a 72 bytes. El registro siempre crea rol `user`. JWT de una hora en `Authorization: Bearer`.
- **Recetas**: lecturas públicas (`GET /recipes`, `/recipes/stats`, `/recipes/:id`); `POST`, `PUT`, `PATCH` y `DELETE` requieren token. Solo el propietario o un administrador modifican o borran; otro usuario recibe 403; sin token o con token inválido, 401; receta inexistente, 404.
- **Consulta**: `search`, `favorite`, `category`, `userId`, `sort` (id, title, minutes, favorite, category), `order`, `page` (1–100000), `limit` (1–100, por defecto 10). Respuesta `{"page","limit","total","items"}`; primero se filtra, luego se ordena, después se pagina. Los parámetros desconocidos, mal formados, fuera de rango o repetidos devuelven 400 con la lista completa de incidencias.
- **Validación de cuerpos**: 400 con `{"errors":[{"field","message"}]}`. POST y PUT validan el cuerpo completo (en PUT, lo que no se envía vuelve a su valor por defecto). PATCH valida solo lo que llega, y sin campos válidos devuelve 400.
- **Resumen**: `GET /recipes/stats` devuelve `{"total","favorites","averageMinutes","byCategory"}`, con las cinco categorías siempre y la media con un decimal.
- **Otras respuestas**: ruta inexistente `404 {"error":"Route not found"}`; JSON mal formado `400 {"error":"Bad request"}`; fallo interno `500 {"error":"Server error"}`.
- Incluía ejemplos de crear receta, listado ordenado y parámetros incorrectos.

### Mensaje 2 (convertir en script)

> Reescribe todas tus comprobaciones como un único script bash ejecutable (bash tester-script.sh) que use curl y jq. Requisitos:
>
> 1. Por cada comprobación imprime una línea con el nombre, el código de estado esperado y el real, y marca OK o FALLA. Para las que el contrato define la forma o los valores del cuerpo (campos presentes, valores, total, items, userId, errors, etc.), comprueba también el cuerpo con jq y marca FALLA si no coincide. No te limites al código de estado.
> 2. El script debe ser repetible: usa un token único por ejecución en títulos y correos, y registra los ids de todas las recetas que crees. Con un trap en EXIT, bórralas con DELETE (usando el token que corresponda o el del administrador) aunque alguna comprobación falle. Si psql y DATABASE_URL están disponibles, borra también los usuarios que registraste (DELETE FROM users WHERE email LIKE 'qa<token>-%'); si no, avisa de que quedan usuarios de prueba.
> 3. Al final imprime el resumen (total, OK, FALLA) y termina con código de salida distinto de cero si hay algún FALLA.
> 4. No añadas comprobaciones nuevas. Si al escribir el script detectas que alguna expectativa de tu lista contradice el contrato, no la dejes como estaba: corrígela en el script y avisa de cuál era y qué cambiaste.

### Artefactos

| Fichero | Qué es |
|---|---|
| `AI/tester-script-p2.sh` | Script generado por el agente (117 comprobaciones, con comprobación de cuerpos y limpieza automática). |
| `AI/tester-results-p2.txt` | Resultado de ejecutarlo en mi máquina: 117 OK, 0 FALLA. |
| `AI/extra-checks-p2.sh` | Comprobaciones adicionales (48) que resuelven las 19 ambigüedades que dejó el agente. **No es caja negra**: se escribió con el código a la vista, desde la conversación de desarrollo, con el resultado previsto anotado antes de ejecutar. |
| `AI/extra-results-p2.txt` | Resultado de las comprobaciones adicionales: 48 OK, 0 FALLA. |

### Ambigüedades detectadas por el agente y cómo se resolvieron

El agente señaló 19 puntos que el contrato no define. Cada uno se comprobó con `extra-checks-p2.sh` y la decisión quedó fijada así:

1. **Cuerpos de 401/403/404/409**: `{"error":"Authentication required"}`, `{"error":"Invalid or expired token"}`, `{"error":"Forbidden"}`, `{"error":"Recipe not found"}`, `{"error":"Email already registered"}`.
2. **Errores 400 en `/auth`**: misma forma `{"errors":[{"field","message"}]}` que en recetas.
3. **Orden de `errors`**: el de los campos del esquema (title, minutes, favorite, category).
4. **Precedencia**: JSON mal formado (400) → token (401) → receta existe (404) → propietario o admin (403) → cuerpo válido (400).
5. **Ids mal formados** (`abc`, `0`, `-1`, `01`, `1.5`, `1e0`, `0x1`, fuera de rango): 404.
6. **PATCH atómico**: si un campo es inválido no se aplica ninguno.
7. **PATCH solo con `id` o `userId`**: 400 (`body: at least one field is required`).
8. **Título de solo espacios**: 400.
9. **Sin conversión de tipos**: `"40"` y `"true"` son 400; `40.0` es 40.
10. **Mayúsculas**: valores sensibles (`category: "Postre"`, `favorite=TRUE`, `order=DESC` dan 400).
11. **Parámetros especiales**: `search=` vacío no filtra; `Sort` es un parámetro desconocido (400); `%` y `_` se buscan como texto literal.
12. **Orden por `favorite`** (false antes que true en ascendente). **Orden por título**: observado con la collation `C` de mi PostgreSQL (`Zumo < avena < banana < Árbol < Ñoqui`); limitación conocida.
13. **Campos desconocidos en el cuerpo**: se aceptan y se descartan.
14. **Correo**: se normaliza (minúsculas y sin espacios) y el duplicado se detecta sin distinguir mayúsculas.
15. **`Location`**: ruta relativa (`/recipes/<id>`).
16. **`byCategory`**: objeto con las cinco claves.
17. **Sin `Content-Type`**: el cuerpo se trata como vacío (400 por campos obligatorios). **Métodos o rutas no definidos**: 404 `Route not found`.
18. **Borrar un usuario borra en cascada sus recetas** (`ON DELETE CASCADE`).
19. **Token caducado**: 401. Un 500 no se puede provocar desde fuera.

## Agente 2 — UX/UI (vista de listado de recetas)

### Papel y límites

- Segunda conversación nueva de claude.ai, **independiente del agente tester** y sin acceso al código del proyecto.
- Propone el JSX de **una vista**: `src/pages/RecipeListPage.jsx`. Recibe solo los requisitos de la vista y las interfaces ya existentes, y lista al final lo que ha tenido que suponer.
- Al no ver el proyecto, no puede saber cómo encaja en el `Layout` ni qué reglas tiene la hoja de estilos. Esa integración la revisa una persona.

### Contexto entregado

- Stack: React 19, Vite, react-router-dom 7, JavaScript, una sola hoja de estilos global (sin estilos en línea ni librerías de componentes).
- Interfaces que debe usar y no reimplementar: `listRecipes(params)` y `getStats()` del módulo de API (formato `{page, limit, total, items}`, errores con `.message` y `.status`), el hook `useApi(fetcher, deps)` (`data`, `loading`, `error`, `reload`) y `useAuth()` (`user` o `null`).
- Clases CSS existentes: `.alert`, `.btn`, `.btn-secondary`, `.link-button`, `.empty`, `.badge`, `.star`, `.recipe-list`, `.recipe-card`, `.recipe-title`, `.pagination`, `.filters`, `.field`, `.field-check`, `.stats`.
- Requisitos funcionales: búsqueda por título, filtro por categoría, solo favoritas, ordenación, "solo las mías" si hay sesión; todo el filtrado, orden y paginación en el servidor; estado de filtros y página en la URL; 10 elementos por página con el número de páginas calculado desde el `total` de la API; búsqueda sin una petición por tecla; resumen de `getStats` sobre el listado.
- Requisitos de estados y accesibilidad: cuatro estados diferenciados (cargando, error con reintento, vacío con acción para quitar filtros, éxito) y página inexistente; HTML semántico (un `h1`, `role="search"`, `label` en cada control, `nav` con `aria-label`, `ul`/`li`); mensajes dinámicos anunciados; uso completo con teclado; textos en español.
- Formato de respuesta pedido: el archivo completo, decisiones de diseño, CSS adicional (o "ninguno") y "supuestos o dudas".

### Mensaje enviado

Un único mensaje con el papel, el stack, las interfaces, los requisitos funcionales, los requisitos de estados y accesibilidad y el formato de respuesta. Se pidió expresamente no inventar lo no definido y listarlo como "supuestos o dudas".

### Qué entregó el agente

- Un archivo de 406 líneas con una variable `view` (`loading`, `error`, `empty`, `out-of-range`, `success`) que impide mostrar dos estados a la vez.
- Estado en la URL (`q`, `category`, `favorite=1`, `mine=1`, `sort`, `page`) con valores por defecto fuera de la URL y valores no válidos ignorados; cualquier cambio de filtro borra `page`.
- Búsqueda con espera de 400 ms, con Enter o el botón "Buscar" aplicándose al momento.
- Región `role="status"` siempre montada, foco al encabezado de resultados al cambiar de página y `key` estables en todas las listas.
- CSS adicional: ninguno. Once supuestos o dudas, entre ellos si el `Layout` ya incluía un `<main>` y qué estilos tenían `.stats` y `.pagination`.

### Artefactos y commits

| Commit | Qué contiene |
|---|---|
| `1fab05f` | La propuesta del agente **tal cual**, integrada sin modificar. Contiene el defecto del `<main>` anidado. |
| `6ced733` | Corrección: `<main>` → `<div>`, resumen en una línea y márgenes de la tarjeta. |