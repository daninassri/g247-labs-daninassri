# Registro de revisión del agente

El código de la API y del cliente se desarrolló con Claude en una conversación. El agente tester fue otra conversación, sin acceso al código. Los scripts de comprobación extra los escribió la conversación de desarrollo conociendo el código, así que no son de caja negra.

## 1. Contrato y prompt del tester

- **Solicitado:** comprobaciones de caja negra a partir del contrato, con las ambigüedades listadas aparte.
- **Devuelto:** una lista de comprobaciones con `curl` y 20 ambigüedades.
- **Decisión:** el prompt lo redactó la conversación de desarrollo y se envió sin cambios. El contrato se recortó siguiendo su indicación para que el agente no viera detalles de implementación (cómo se instala `express.static`, el orden de rutas de `/stats`, el cliente web).
- **Motivo:** que las comprobaciones salgan solo del contrato, no del código.

## 2. Script de comprobaciones

- **Solicitado:** reescribir las comprobaciones como un script que compare códigos y muestre el cuerpo, sin añadir ni cambiar nada.
- **Devuelto:** `tester-script.sh`, con 84 comprobaciones.
- **Aceptado:** el desvío del fichero temporal para guardar el cuerpo. Lo acepté yo, porque repetir peticiones habría creado y borrado recetas dos veces.
- **Resultado:** la primera ejecución partió de un servidor recién arrancado (el primer id asignado fue el 7) y dio 84 OK, 0 FALLA.
- **Límite del script:** solo compara códigos de estado. Los cuerpos hay que compararlos a mano, y eso se hizo después con el fichero de resultados.

## 3. Seis expectativas erróneas del agente

- **Qué pasó:** en seis comprobaciones de filtros y ordenación el agente esperaba menos recetas de las que devolvió la API. No contó las recetas `Patch2`, `CmpA` y `CmpB`, que creó antes y que también llevan el token de la ejecución.
- **Quién las detectó:** las anticipó el propio agente en su respuesta. La revisión del script en la conversación de desarrollo llegó a la misma tabla.
- **Quién tenía razón:** la API, en las seis.
- **Por qué salían OK:** devuelven `200`, y el script no compara cuerpos.
- **Qué se hizo:** no se modificó el script. Se dejó como evidencia y la diferencia se resolvió comparando `esperado:` con `cuerpo:`.
- **Origen del error:** la instrucción "no cambies las que ya hiciste" hizo que el agente las conservara.

## 4. Ambigüedades y su resolución

Para comprobarlas se escribió `extra-checks.sh`, con resultados en `extra-results.txt`. Cada comprobación llevaba escrito de antemano el resultado previsto según el código, y todas coincidieron salvo la del id (punto 5).

| # | Resolución |
|---|---|
| 1, 2, 5, 6, 7, 9, 10, 11, 13, 15, 16 | Comprobadas con `extra-checks.sh`. El comportamiento está en el README. |
| 3, 4, 18 | Observadas en los resultados. El README muestra algunos ejemplos, no todos los mensajes. |
| 12 | Comprobada. Se encontró un defecto y se corrigió (punto 5). Los ids no se reutilizan tras borrar. |
| 14 | Comprobada: `/recipes/stats` y `/recipes/:id` ignoran los parámetros de consulta. |
| 17 | Comprobada: con 0 recetas, `averageMinutes` es 0 y `byCategory` incluye las cinco categorías. |
| 19 | Resuelta leyendo el código: `title` no tiene longitud máxima. No se probó desde fuera. |
| 8 | **Parcial.** El desempate con valores iguales se observó y se documentó (punto 6). No se han verificado el orden de títulos con tildes o mayúsculas, ni el de `favorite` y `category`. |
| 20 | No se puede comprobar desde fuera. Por lectura del código, el manejador de errores de `app.js` responde `{"error":"Server error"}` sin trazas. |

## 5. Defecto encontrado: formato del id

- **Origen:** la ambigüedad 12 del agente.
- **Predicción:** al leer el código, la conversión del id con `Number(...)` debía aceptar `01`, `1.0`, `1e0` y `0x1` como la receta 1, y el README dice que un id que no es un número devuelve `404`.
- **Confirmación:** `extra-checks.sh` devolvió `200` para los cuatro.
- **Decisión:** la corrección la propuso la conversación de desarrollo y la apliqué yo. Se añadió `parseId`, que solo acepta enteros positivos escritos de forma canónica.
- **Verificación:** `01`, `1.0`, `1e0` y `0x1` dan ahora `404`, y `1` da `200`. Al repetir `tester-script.sh` (`tester-results-2.txt`): 84 OK, 0 FALLA.

## 6. Orden con valores iguales

- **Observado:** en `order=asc`, `CmpA` (id 16) sale antes que `CmpB` (id 17); en `order=desc`, `CmpB` antes que `CmpA`.
- **Causa:** el controlador ordena de menor a mayor y luego invierte la lista.
- **Decisión:** no es un fallo, no se cambió el código. Se documentó en el README como comportamiento definido.

## 7. README

Se añadió la sección "Comportamiento en casos límite". Cada línea corresponde a un resultado visto en `tester-results.txt` o en `extra-results.txt`.

## Qué comprobé yo personalmente

- Probé la API a mano con `curl`: las cuatro rutas básicas, `PUT`, `PATCH` (cambiando solo un campo), `DELETE`, el `404` posterior, los filtros, la ordenación, la paginación, los parámetros inválidos y `/stats`.
- Probé el cliente en el navegador: listar, buscar, filtrar, crear, editar, marcar favorita, eliminar, los errores del cliente y del servidor junto a cada campo, el estado de lista vacía y el aviso con el servidor apagado.
- Ejecuté `tester-script.sh` (84 OK, 0 FALLA) y `extra-checks.sh`, y pasé los resultados a la conversación de desarrollo para analizarlos.
- La comparación de los cuerpos recibidos con los esperados la hizo esa conversación, no yo. Las seis expectativas erróneas del agente (punto 3) ya las había señalado él mismo.
- Acepté que el script guardara el cuerpo en un fichero temporal, y apliqué yo el arreglo del id (`parseId`) en el controlador. Comprobé que el `grep` mostraba las cuatro llamadas, que `01`, `1.0`, `1e0` y `0x1` daban `404` y que la prueba completa seguía en 84 OK.
- La política de rechazar con `400` los parámetros mal formados la propuso la IA y yo la acepté.
- No he comprobado desde fuera la ambigüedad 8 (orden de títulos con tildes, de `favorite` y de `category`), la 19 (longitud del título) ni la 20 (el error 500). Esas dependen de leer el código.