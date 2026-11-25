# Registro de revisión de IA — Práctica 2

Fecha de las comprobaciones de la parte del agente tester: 25 de noviembre de 2026. La parte del agente UX/UI se añade en el apartado siguiente.

## Agente 1 — Tester de caja negra

### Qué se pidió
- Se abrió una conversación nueva de Claude, sin acceso al código, y se le entregó solo el contrato HTTP y la configuración (ver `AI/agents.md`).
- Se le pidió un listado de comprobaciones con `curl` y sus resultados esperados, la lista de ambigüedades del contrato, y después un único script bash con `curl` y `jq`.
- Respecto a P1 se añadió, a raíz de la corrección del profesor: comprobar cuerpos con `jq`, limpieza automática con `trap` y cobertura de los cuatro perfiles de acceso.

### Qué se comprobó
- El script se ejecutó contra mi API y mi PostgreSQL locales: **117 comprobaciones, 117 OK, 0 FALLA** (`AI/tester-results-p2.txt`). La limpieza funcionó: no quedaron recetas ni usuarios de prueba.
- Se revisó que el script cubriera casos correctos, errores, los cuatro perfiles (anónimo, propietario, otro usuario, administrador), PUT frente a PATCH, filtros combinados con `total`, paginación, parámetros inválidos, `id` y `userId` enviados en el cuerpo, y token ausente o mal formado. Se revisó también que sus expectativas de cuerpo coincidieran con el contrato y no con lo que la API devuelve por casualidad.
- Las 19 ambigüedades que listó el agente se resolvieron con 48 comprobaciones adicionales (`AI/extra-checks-p2.sh`), con el resultado previsto anotado antes de ejecutarlas: **48 OK, 0 FALLA** (`AI/extra-results-p2.txt`). Esas comprobaciones **no son de caja negra**: se escribieron con el código a la vista, desde la conversación de desarrollo.

### Qué se aceptó
- El script del agente tal como lo entregó: ninguna expectativa contradecía el contrato y no hizo falta corregir ninguna.
- Las 19 ambigüedades como definición del comportamiento de la API; quedan documentadas en `AI/agents.md` y en el contrato del `README.md`.

### Qué se corrigió
- **En el script del agente: nada.** No salió ningún FALLA, ni de la API ni de una expectativa mal planteada. Lo registro tal cual: esta vez la ejecución no encontró defectos.
- Tampoco hay ningún defecto introducido por el agente, así que no hay commit que enlazar para esta parte.

### Qué se descartó
- Dar por buenas las suposiciones del agente sobre los puntos que el contrato no define. Cada una se contrastó con el código y con una comprobación antes de aceptarla.
- Un 500 provocado desde fuera: no se puede forzar sin tocar la base de datos o el código, y queda fuera de una prueba de caja negra.

### Hallazgo no previsto
- El orden por título en mi PostgreSQL es por bytes (collation `C`): `Zumo < avena < banana < Árbol < Ñoqui`. Comprobado con la comprobación 12c. No se cambia el código. Queda como **limitación conocida**: una opción de mejora sería indicar una collation en español en la consulta o en la base de datos.

### Reflexión
- **Tiempo ahorrado**: el agente generó en poco tiempo 117 comprobaciones con cuerpo y limpieza, y una lista de 19 puntos que el contrato no definía. Escribirlo a mano me habría llevado bastante más y habría cubierto menos.
- **Qué necesita revisión humana**: que las expectativas vengan del contrato y no del comportamiento actual de la API, y que los puntos no definidos se decidan por una persona. Que las 117 pasen no demuestra que la API esté libre de errores: solo que cumple lo que el contrato dice.
- **Límites**: al ser de caja negra, el agente no puede probar un 500 ni un token caducado sin conocer el secreto. Esos casos los cubrió la comprobación adicional 19, con el código a la vista.

## Agente 2 — UX/UI (vista de listado)

Fecha: 25 de noviembre de 2026.

### Qué se pidió
- Una propuesta de JSX para la vista de listado de recetas (`RecipeListPage.jsx`), dándole solo los requisitos y las interfaces existentes (ver `AI/agents.md`), sin ver mi código.

### Qué se comprobó
- **Integración**: que usara `listRecipes`, `getStats`, `useApi` y `useAuth` con sus firmas reales, que el `total` saliera de la API y que filtros, orden y paginación fueran al servidor.
- **Semántica**: un solo `h1`, formulario con `role="search"`, `label` en cada control, `nav` con `aria-label`, lista con `ul`/`li` y mensajes con `role="status"` y `role="alert"`.
- **Estados de la interfaz**: cargando, error con reintento, vacío, página inexistente y éxito.
- **Claves de las listas**: `key={recipe.id}` en las recetas y `key={valor}` en las opciones de los selectos. Ninguna usa el índice.
- Pruebas: 17 comprobaciones automatizadas en navegador, ejecutadas desde la conversación de desarrollo en un entorno aparte (búsqueda con una sola petición, filtro en servidor, página 2 y atrás, página inexistente, vacío, error y reintento, "solo las mías" con `userId` y ancho móvil). Además, pruebas manuales en mi navegador: la vista funciona y el número de elementos `<main>` de la página es **2** con la propuesta tal cual y **1** tras la corrección.

### Qué se aceptó
- La estructura de estados con una sola variable `view`, la URL como fuente de verdad de los filtros, la espera de 400 ms con aplicación inmediata por Enter, el foco al encabezado de resultados al paginar, la región `role="status"` siempre montada, los mensajes diferenciados por estado (incluido el de falta de conexión con `status === 0`) y las etiquetas de categoría con mayúscula inicial.
- Los supuestos del agente que se comprobaron y eran correctos: `useApi` descarta respuestas antiguas, el servidor acepta `favorite=true` y `limit=10`, y `averageMinutes` es un número.

### Qué se corrigió
- **Defecto introducido por el agente: `<main>` anidado.** La vista envolvía todo en `<main>` y el `Layout` ya tenía `<main id="contenido">`, así que la página tenía dos (HTML inválido y confuso para lectores de pantalla). El propio agente había señalado la duda en sus supuestos, pero no tenía forma de comprobarla. Commit con el defecto: `1fab05f`. Commit que lo corrige: `6ced733`.
- **Resumen**: usaba `<dl className="stats">`, pero mi CSS de `.stats` está pensado para un `<p>`, así que se veía apilado y descuadrado. Se volvió a una línea (`30 recetas · 10 favoritas · 40,1 min de media`) conservando su estado de error con reintento. También se quitó el `h2 "Resumen"` y el texto de "Cargando resumen…".
- **Tarjetas**: el `<h3>` y el `<p>` dentro de cada receta aportaban márgenes por defecto que las hacían más altas; se añadió una regla de CSS (`.recipe-card h3, .recipe-card p { margin: 0; font-size: 1rem; }`).

### Qué se descartó
- El `<dl>` del resumen y el `h2 "Resumen"` (ver arriba).
- No se cambió el botón "Buscar", aunque la búsqueda ya se aplica sola con la espera: se conserva porque permite aplicarla con Enter o con un clic.

### Reflexión
- **Tiempo ahorrado**: el agente entregó en una sola respuesta una vista completa, con estados, URL y accesibilidad, que en lo funcional pasó casi todas las pruebas a la primera. Escribir esa vista a mano, con el foco, la región de estado y el control de página inexistente, me habría llevado bastante más.
- **Qué necesita revisión humana**: todo lo que depende de partes del proyecto que el agente no ve. Los dos defectos que aparecieron (`<main>` y estilos de `.stats`) eran justo dos de los supuestos que él mismo había listado. Un agente sin acceso al proyecto puede dejar la duda por escrito, pero la comprobación hay que hacerla contra el proyecto real.
- **Complejidad**: la propuesta es más compleja que mi versión original (varias referencias para sincronizar el campo de búsqueda con la URL). Antes de aceptarla comprobé que funciona y que sé explicar para qué sirve cada parte.