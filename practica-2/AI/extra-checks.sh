#!/usr/bin/env bash
# Comprobaciones adicionales a raíz de las ambigüedades del agente tester.
# Uso: reiniciar el servidor y ejecutar UNA sola vez: bash AI/extra-checks.sh
# El último bloque borra todas las recetas: reiniciar el servidor después.

BASE="${BASE:-http://localhost:3000}"
CT="Content-Type: application/json"

t() {   # descripción, esperado según el código, argumentos de curl
  printf '\n## %s\n   esperado según el código: %s\n' "$1" "$2"
  shift 2
  curl -s -w '\n   [HTTP %{http_code}]\n' "$@"
}

# 1 y 11: cuerpo del 404 y precedencia entre 404 y 400
t "GET id inexistente (amb. 1)" '404 {"error":"Recipe not found"}' "$BASE/recipes/9999"
t "PATCH a id inexistente con cuerpo inválido (amb. 11)" '404, gana el 404' -X PATCH "$BASE/recipes/9999" -H "$CT" -d '{"minutes":0}'
t "PUT a id inexistente con JSON roto (amb. 11)" '400 Bad request, el JSON se procesa antes que la ruta' -X PUT "$BASE/recipes/9999" -H "$CT" -d '{"title":'

# 2 y 10: PATCH sin campos válidos
t "PATCH con cuerpo vacío (amb. 2)" '400 con field body: at least one field is required' -X PATCH "$BASE/recipes/1" -H "$CT" -d '{}'
t "PATCH con solo id (amb. 10)" 'igual que el anterior: id no cuenta como campo válido' -X PATCH "$BASE/recipes/1" -H "$CT" -d '{"id":5}'

# 5, 6 y 7: valores límite en el cuerpo
t "title solo espacios (amb. 5)" '400 title must be a non-empty string' -X POST "$BASE/recipes" -H "$CT" -d '{"title":"   ","minutes":10,"category":"rapida"}'
t "category con mayúscula (amb. 6)" '400 category must be one of' -X POST "$BASE/recipes" -H "$CT" -d '{"title":"Mayus","minutes":10,"category":"Postre"}'
t "minutes 40.0 (amb. 7)" '201, el JSON 40.0 es el entero 40' -X POST "$BASE/recipes" -H "$CT" -d '{"title":"Cuarenta","minutes":40.0,"category":"rapida"}'
t "minutes null (amb. 7)" '400 sobre minutes' -X POST "$BASE/recipes" -H "$CT" -d '{"title":"Nulo","minutes":null,"category":"rapida"}'
t "favorite null (amb. 7)" '400 sobre favorite' -X POST "$BASE/recipes" -H "$CT" -d '{"title":"Nulo","minutes":10,"favorite":null,"category":"rapida"}'
t "title numérico (amb. 7)" '400 sobre title' -X POST "$BASE/recipes" -H "$CT" -d '{"title":123,"minutes":10,"category":"rapida"}'

# 6: mayúsculas en la consulta
t "sort en mayúsculas (amb. 6)" '400 sobre sort' "$BASE/recipes?sort=TITLE"
t "order en mayúsculas (amb. 6)" '400 sobre order' "$BASE/recipes?order=ASC"
t "favorite en mayúsculas (amb. 6)" '400 sobre favorite' "$BASE/recipes?favorite=TRUE"

# 9: PATCH con un campo válido y otro inválido
t "PATCH con minutes válido y favorite inválido (amb. 9)" '400 solo sobre favorite' -X PATCH "$BASE/recipes/2" -H "$CT" -d '{"minutes":50,"favorite":"no"}'
t "GET de esa receta (amb. 9)" 'minutes sigue en 15, no se aplicó nada' "$BASE/recipes/2"

# 12: formatos de id
for v in 01 1.0 1e0 0x1; do
  t "GET /recipes/$v (amb. 12)" '200 con la receta 1: el id no se interpreta de forma estricta' "$BASE/recipes/$v"
done
for v in 1.5 -1; do
  t "GET /recipes/$v (amb. 12)" '404' "$BASE/recipes/$v"
done

# 13: valores vacíos en la consulta
t "search vacío (amb. 13)" '200 y todas las recetas, no filtra' "$BASE/recipes?search="
t "limit vacío (amb. 13)" '400 sobre limit' "$BASE/recipes?limit="
t "sort vacío (amb. 13)" '400 sobre sort' "$BASE/recipes?sort="

# 14: parámetros en endpoints que no los admiten
t "stats con parámetro desconocido (amb. 14)" '200, se ignora' "$BASE/recipes/stats?foo=1"
t "GET por id con parámetro desconocido (amb. 14)" '200, se ignora' "$BASE/recipes/1?foo=1"

# 15: otros cuerpos de petición
t "POST sin cuerpo (amb. 15)" '400 con los tres errores de campo obligatorio' -X POST "$BASE/recipes" -H "$CT"
t "POST con array (amb. 15)" '400 con los tres errores de campo obligatorio' -X POST "$BASE/recipes" -H "$CT" -d '[]'
t "POST con null (amb. 15)" '400 Bad request' -X POST "$BASE/recipes" -H "$CT" -d 'null'
t "POST con claves duplicadas (amb. 15)" '201 y gana la última clave: title Segundo' -X POST "$BASE/recipes" -H "$CT" -d '{"title":"Primero","title":"Segundo","minutes":10,"category":"rapida"}'
t "POST sin Content-Type JSON (amb. 15)" '400 con los tres errores de campo obligatorio, el cuerpo no se lee' -X POST "$BASE/recipes" -H "Content-Type: text/plain" -d '{"title":"Texto","minutes":10,"category":"rapida"}'

# 16: método no permitido
t "DELETE sobre la colección (amb. 16)" '404 Route not found' -X DELETE "$BASE/recipes"
t "POST sobre un id (amb. 16)" '404 Route not found' -X POST "$BASE/recipes/1" -H "$CT" -d '{}'

# 17: stats con la colección vacía (borra todo)
for i in $(curl -s "$BASE/recipes" | jq -r '.[].id'); do
  curl -s -o /dev/null -X DELETE "$BASE/recipes/$i"
done
t "stats con la colección vacía (amb. 17)" '200 con total 0, averageMinutes 0 y las cinco categorías a 0' "$BASE/recipes/stats"

echo
echo "Fin. Reinicia el servidor: Ctrl+C y npm start."