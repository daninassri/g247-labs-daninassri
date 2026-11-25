#!/usr/bin/env bash
# Comprobaciones extra de P2. Resuelven las ambigüedades que el agente tester dejó sin definir.
# A diferencia de tester-script-p2.sh, este script se escribió CON el código a la vista (no es caja negra):
# cada comprobación lleva el resultado previsto según el código, escrito antes de ejecutarla.
# Uso (con la API en marcha, desde practica-2/AI):  set -a; . ../.env; set +a; bash extra-checks-p2.sh
# Requiere curl, jq y, para limpiar y para las comprobaciones 18 y 19, psql + DATABASE_URL, node + JWT_SECRET.

BASE="${BASE:-http://localhost:3000}"
CT='Content-Type: application/json'
U="xc$(date +%s)$RANDOM"
TMP=$(mktemp -d)
OKS=0; FALLAS=0; IDS=()

login() { curl -s -X POST "$BASE/auth/login" -H "$CT" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.token // empty'; }
ADMIN=$(login admin@example.com Admin1234); ANA=$(login ana@example.com Demo1234); BEN=$(login ben@example.com Demo1234)
[ -n "$ADMIN" ] && [ -n "$ANA" ] && [ -n "$BEN" ] || { echo "No se pudo iniciar sesión con los usuarios de demostración"; exit 2; }

cleanup() {
  for id in "${IDS[@]}"; do curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $ADMIN" "$BASE/recipes/$id"; done
  if command -v psql >/dev/null && [ -n "$DATABASE_URL" ]; then
    psql "$DATABASE_URL" -q -c "DELETE FROM users WHERE email LIKE '${U}-%';" && echo "Usuarios de prueba (${U}-*) borrados."
  else
    echo "AVISO: sin psql/DATABASE_URL; quedan usuarios ${U}-* en la base de datos."
  fi
  rm -rf "$TMP"
  echo; echo "Resumen: OK=$OKS FALLA=$FALLAS"
}
trap cleanup EXIT

# x NOMBRE ESTADO_PREVISTO "DESCRIPCIÓN DEL CUERPO PREVISTO" FILTRO_JQ(o vacío) curl-args...
x() {
  local name=$1 exp=$2 desc=$3 filtro=$4; shift 4
  local real res=FALLA
  real=$(curl -s -D "$TMP/h" -o "$TMP/b" -w '%{http_code}' "$@")
  local ok=1
  [ "$real" = "$exp" ] || ok=0
  if [ -n "$filtro" ]; then jq -e "$filtro" "$TMP/b" >/dev/null 2>&1 || ok=0; fi
  if [ $ok = 1 ]; then res=OK; OKS=$((OKS+1)); else FALLAS=$((FALLAS+1)); fi
  printf '%-5s | %s | previsto %s | real %s\n' "$res" "$name" "$exp" "$real"
  echo "        previsto: $desc"
  echo "        cuerpo:   $(tr -d '\n' < "$TMP/b" | cut -c1-260)"
}
mk() { # crea una receta con el token $1 y el cuerpo $2; guarda el id en $NEWID
  NEWID=$(curl -s -X POST "$BASE/recipes" -H "Authorization: Bearer $1" -H "$CT" -d "$2" | jq -r '.id // empty')
  [ -n "$NEWID" ] && IDS+=("$NEWID")
}
section() { printf '\n== %s ==\n' "$1"; }
A="Authorization: Bearer $ANA"; B="Authorization: Bearer $BEN"; AD="Authorization: Bearer $ADMIN"
mk "$ANA" '{"title":"'"$U"' base","minutes":30,"favorite":true,"category":"postre"}'; R=$NEWID

section "1. Forma de los cuerpos de error (ambigüedades 1 y 2)"
x "1a 401 sin token" 401 '{"error":"Authentication required"}' '.error=="Authentication required"' -X POST "$BASE/recipes" -H "$CT" -d '{}'
x "1b 401 token inválido" 401 '{"error":"Invalid or expired token"}' '.error=="Invalid or expired token"' -X POST "$BASE/recipes" -H "Authorization: Bearer x" -H "$CT" -d '{}'
x "1c 403 receta ajena" 403 '{"error":"Forbidden"}' '.error=="Forbidden"' -X DELETE "$BASE/recipes/$R" -H "$B"
x "1d 404 receta inexistente" 404 '{"error":"Recipe not found"}' '.error=="Recipe not found"' "$BASE/recipes/99999999"
x "1e 409 correo duplicado" 409 '{"error":"Email already registered"}' '.error=="Email already registered"' -X POST "$BASE/auth/register" -H "$CT" -d '{"email":"ana@example.com","password":"Demo1234"}'
x "2a 400 registro: forma {errors:[{field,message}]}" 400 'errors con email y password' '(.errors|map(.field)|sort)==["email","password"]' -X POST "$BASE/auth/register" -H "$CT" -d '{}'
x "2b 400 acceso: misma forma" 400 'errors con email y password' '(.errors|map(.field)|sort)==["email","password"]' -X POST "$BASE/auth/login" -H "$CT" -d '{}'

section "3. Mensajes y orden de errors (ambigüedad 3)"
x "3 orden = orden de los campos del esquema (title, minutes, favorite, category)" 400 'campos en ese orden' '[.errors[].field]==["title","minutes","favorite","category"]' -X POST "$BASE/recipes" -H "$A" -H "$CT" -d '{"title":"","minutes":0,"favorite":"x","category":"y"}'
x "3 mensaje de minutes fuera de rango" 400 '"minutes must be an integer between 1 and 600"' '.errors[0].message=="minutes must be an integer between 1 and 600"' -X POST "$BASE/recipes" -H "$A" -H "$CT" -d '{"title":"t","minutes":601,"category":"postre"}'

section "4. Precedencia entre errores (ambigüedad 4)"
x "4a PUT con cuerpo inválido a receta inexistente: gana 404" 404 '404' '' -X PUT "$BASE/recipes/99999999" -H "$A" -H "$CT" -d '{}'
x "4b ajeno con cuerpo inválido: gana 403" 403 '403' '' -X PUT "$BASE/recipes/$R" -H "$B" -H "$CT" -d '{}'
x "4c anónimo a id inexistente: gana 401" 401 '401' '' -X PUT "$BASE/recipes/99999999" -H "$CT" -d '{}'
x "4d JSON mal formado con token inexistente: gana 400 (el parser va antes)" 400 '{"error":"Bad request"}' '.error=="Bad request"' -X PUT "$BASE/recipes/99999999" -H "$CT" -d '{bad'

section "5. Ids mal formados (ambigüedad 5): todos 404"
for id in abc 0 -1 01 1.5 1e0 0x1 99999999999; do
  x "5 GET /recipes/$id" 404 '{"error":"Recipe not found"}' '.error=="Recipe not found"' "$BASE/recipes/$id"
done

section "6 y 7. PATCH atómico y PATCH sin campos válidos (ambigüedades 6 y 7)"
x "6 PATCH con un campo válido y otro inválido: no aplica nada" 400 '400' '' -X PATCH "$BASE/recipes/$R" -H "$A" -H "$CT" -d '{"title":"cambiado","minutes":0}'
x "6 el título sigue igual" 200 'título sin cambiar' '.title=="'"$U"' base"' "$BASE/recipes/$R"
x "7a PATCH solo con id" 400 '{"errors":[{"field":"body","message":"at least one field is required"}]}' '.errors[0].field=="body"' -X PATCH "$BASE/recipes/$R" -H "$A" -H "$CT" -d '{"id":5}'
x "7b PATCH solo con userId" 400 'igual que 7a' '.errors[0].field=="body"' -X PATCH "$BASE/recipes/$R" -H "$A" -H "$CT" -d '{"userId":3}'

section "8 y 9. Título con espacios y conversión de tipos (ambigüedades 8 y 9)"
x "8 título de solo espacios" 400 'title must be a non-empty string' '.errors[0].field=="title"' -X POST "$BASE/recipes" -H "$A" -H "$CT" -d '{"title":"   ","minutes":5,"category":"rapida"}'
x "9a minutes como texto" 400 'minutes' '.errors[0].field=="minutes"' -X POST "$BASE/recipes" -H "$A" -H "$CT" -d '{"title":"t","minutes":"40","category":"rapida"}'
x "9b favorite como texto" 400 'favorite' '.errors[0].field=="favorite"' -X POST "$BASE/recipes" -H "$A" -H "$CT" -d '{"title":"t","minutes":5,"favorite":"true","category":"rapida"}'
x "9c minutes 40.0 (el JSON lo lee como 40)" 201 'minutes=40' '.minutes==40' -X POST "$BASE/recipes" -H "$A" -H "$CT" -d '{"title":"'"$U"' c","minutes":40.0,"category":"rapida"}'
ID9=$(jq -r '.id' "$TMP/b"); IDS+=("$ID9")

section "10 y 11. Mayúsculas y valores especiales (ambigüedades 10 y 11)"
x "10a category con mayúscula en el cuerpo" 400 'category' '.errors[0].field=="category"' -X POST "$BASE/recipes" -H "$A" -H "$CT" -d '{"title":"t","minutes":5,"category":"Postre"}'
x "10b favorite=TRUE" 400 'favorite' '.errors[0].field=="favorite"' "$BASE/recipes?favorite=TRUE"
x "10c order=DESC" 400 'order' '.errors[0].field=="order"' "$BASE/recipes?order=DESC"
x "11a search vacío no filtra" 200 'total igual que sin parámetro' '.total>=1' "$BASE/recipes?search="
x "11b Sort con mayúscula es un parámetro desconocido" 400 'foo/Sort unknown' '.errors[0].field=="Sort"' "$BASE/recipes?Sort=id"
x "11c search=% es literal (no comodín)" 200 'total 0' '.total==0' "$BASE/recipes?search=%25"
x "11d search=_ es literal" 200 'total 0' '.total==0' "$BASE/recipes?search=_"

section "12. Orden de favoritas (ambigüedad 12)"
x "12a sort=favorite asc: false antes que true" 200 'primero false' '.items[0].favorite==false and .items[-1].favorite==true' "$BASE/recipes?sort=favorite&limit=100"
x "12b sort=favorite desc: true antes que false" 200 'primero true' '.items[0].favorite==true' "$BASE/recipes?sort=favorite&order=desc&limit=100"
for t in "Ñoqui" "avena" "Zumo" "Árbol" "banana"; do mk "$ANA" '{"title":"'"$t $U"'","minutes":5,"category":"rapida"}'; done
echo "        (12c) orden de títulos con tildes y mayúsculas, solo observado (depende del collation de PostgreSQL):"
curl -s "$BASE/recipes?search=$U&sort=title&limit=100" | jq -r '[.items[].title | split(" ")[0]] | join(" < ")' | sed 's/^/        /'

section "13 a 15. Campos desconocidos, correo y Location"
x "13 campos desconocidos en el cuerpo se aceptan y se descartan" 201 'sin color' 'has("color")|not' -X POST "$BASE/recipes" -H "$A" -H "$CT" -d '{"title":"'"$U"' d","minutes":5,"category":"rapida","color":"rojo"}'
IDS+=("$(jq -r '.id' "$TMP/b")")
x "14a correo con mayúsculas y espacios: se normaliza" 201 'email en minúsculas y sin espacios' '.email=="'"$U"'-mayus@example.com"' -X POST "$BASE/auth/register" -H "$CT" -d '{"email":"  '"${U^^}"'-Mayus@Example.com  ","password":"Valida123"}'
x "14b el mismo correo con otra capitalización es duplicado" 409 '409' '' -X POST "$BASE/auth/register" -H "$CT" -d '{"email":"'"$U"'-MAYUS@example.com","password":"Valida123"}'
curl -s -D "$TMP/h" -o "$TMP/b" -X POST "$BASE/recipes" -H "$A" -H "$CT" -d '{"title":"'"$U"' loc","minutes":5,"category":"rapida"}'
LID=$(jq -r '.id' "$TMP/b"); IDS+=("$LID")
LOC=$(grep -i '^location:' "$TMP/h" | cut -d' ' -f2 | tr -d '\r')
[ "$LOC" = "/recipes/$LID" ] && { echo "OK    | 15 Location es relativa: $LOC"; OKS=$((OKS+1)); } || { echo "FALLA | 15 Location = $LOC"; FALLAS=$((FALLAS+1)); }

section "16 y 17. Resumen, Content-Type y métodos"
x "16 byCategory es un objeto con las cinco claves" 200 'objeto' '(.byCategory|type)=="object" and (.byCategory|keys|length)==5' "$BASE/recipes/stats"
x "17a cuerpo sin Content-Type: se trata como vacío" 400 'errors de title, minutes y category' '[.errors[].field]==["title","minutes","category"]' -X POST "$BASE/recipes" -H "$A" -d '{"title":"t","minutes":5,"category":"rapida"}'
x "17b DELETE /recipes (método no definido)" 404 '{"error":"Route not found"}' '.error=="Route not found"' -X DELETE "$BASE/recipes" -H "$AD"
x "17c POST /recipes/1" 404 '{"error":"Route not found"}' '.error=="Route not found"' -X POST "$BASE/recipes/1" -H "$A" -H "$CT" -d '{}'

section "18. Borrar un usuario borra en cascada sus recetas (ambigüedad 18)"
if command -v psql >/dev/null && [ -n "$DATABASE_URL" ]; then
  curl -s -o /dev/null -X POST "$BASE/auth/register" -H "$CT" -d '{"email":"'"$U"'-casc@example.com","password":"Valida123"}'
  TC=$(login "$U-casc@example.com" Valida123); mk "$TC" '{"title":"'"$U"' casc","minutes":5,"category":"rapida"}'; CID=$NEWID
  psql "$DATABASE_URL" -q -c "DELETE FROM users WHERE email='${U}-casc@example.com';"
  x "18 tras borrar al usuario, su receta ya no existe" 404 '404' '' "$BASE/recipes/$CID"
else echo "(se omite: no hay psql o DATABASE_URL)"; fi

section "19. Token caducado (ambigüedad 19; usa JWT_SECRET, así que no es caja negra)"
if [ -n "$JWT_SECRET" ] && command -v node >/dev/null && [ -d ../node_modules/jsonwebtoken ]; then
  EXP=$(cd .. && node -e 'console.log(require("jsonwebtoken").sign({sub:2,role:"user"},process.env.JWT_SECRET,{algorithm:"HS256",expiresIn:-60}))')
  x "19 token firmado y caducado" 401 '{"error":"Invalid or expired token"}' '.error=="Invalid or expired token"' "$BASE/auth/me" -H "Authorization: Bearer $EXP"
else echo "(se omite: falta JWT_SECRET, node o ../node_modules)"; fi