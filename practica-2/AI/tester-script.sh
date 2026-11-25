#!/usr/bin/env bash
# Pruebas de caja negra de la API de recetas.
# Uso:   bash pruebas_recetas.sh
#        BASE=http://localhost:4000 bash pruebas_recetas.sh   (otra URL)
# Requiere: curl y jq (macOS: brew install jq)

BASE="${BASE:-http://localhost:3000}"
command -v jq >/dev/null 2>&1 || { echo "Falta jq (macOS: brew install jq)"; exit 1; }

T="qa$(date +%s)$RANDOM"                          # token único de esta ejecución
TU=$(printf '%s' "${T#qa}" | tr a-z A-Z)          # parte del token, en mayúsculas
CT="Content-Type: application/json"
BODY=$(mktemp); HDRS=$(mktemp)
trap 'rm -f "$BODY" "$HDRS"' EXIT
OKS=0; FALLAS=0

# ---------- utilidades ----------

informar() {   # nombre esperado real
  local res=FALLA
  if [ "$2" = "$3" ]; then res=OK; OKS=$((OKS+1)); else FALLAS=$((FALLAS+1)); fi
  printf '%-5s | %s | esperado %s | real %s\n' "$res" "$1" "$2" "$3"
}

# Comprobación que solo depende del código de estado
chk() {        # nombre esperado args-curl...
  local nombre="$1" esp="$2"; shift 2
  informar "$nombre" "$esp" "$(curl -s -o /dev/null -w "%{http_code}" "$@")"
}

# Comprobación que depende también del cuerpo: imprime el cuerpo recibido
chkb() {       # nombre esperado "cuerpo esperado" "filtro jq (o vacío)" args-curl...
  local nombre="$1" esp="$2" desc="$3" filtro="$4"; shift 4
  local real; real=$(curl -s -D "$HDRS" -o "$BODY" -w "%{http_code}" "$@")
  informar "$nombre" "$esp" "$real"
  echo "        esperado: $desc"
  echo "        cuerpo:   $(cat "$BODY")"
  if [ -n "$filtro" ]; then echo "        jq $filtro: $(jq -c "$filtro" "$BODY" 2>/dev/null)"; fi
}

location() { awk 'tolower($0) ~ /^location:/ {sub(/^[^:]*:[ ]*/, ""); print}' "$HDRS" | tr -d '\r'; }
idloc()    { location | awk -F/ '{print $NF}'; }

# Crea una receta y devuelve su id (preparación, no es una comprobación)
crear() {
  curl -s -D - -o /dev/null -X POST "$BASE/recipes" -H "$CT" -d "$1" \
  | awk -F/ 'tolower($0) ~ /^location:/ {print $NF}' | tr -d '\r '
}

seccion() { printf '\n== %s ==\n' "$1"; }

echo "API: $BASE   token: $T"

# ---------- 1. POST /recipes ----------
seccion "1. POST /recipes"

chkb "POST válido: Location y favorite por defecto" 201 \
  '{"title":"<T> Pisto","minutes":40,"favorite":false,"category":"vegetariano","id":<id>}; mismo id que en Location' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"'"$T"' Pisto","minutes":40,"category":"vegetariano"}'
echo "        location: $(location)"

chkb "POST recorta espacios del título" 201 '"title":"<T> Trim"' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"   '"$T"' Trim   ","minutes":10,"category":"rapida"}'

chk "POST minutes=1 (límite inferior)" 201 \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"'"$T"' Min","minutes":1,"category":"rapida"}'
chk "POST minutes=600 (límite superior)" 201 \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"'"$T"' Max","minutes":600,"category":"principal"}'

chkb "POST cuerpo vacío: todos los errores a la vez" 400 \
  'errors con exactamente 3 entradas: "title is required", "minutes is required", "category is required"' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{}'

chkb "POST title vacío" 400 'errors con field "title"' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"","minutes":10,"category":"rapida"}'

chkb "POST minutes=0" 400 'errors con field "minutes"' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"'"$T"' X","minutes":0,"category":"rapida"}'
chkb "POST minutes=601" 400 'errors con field "minutes"' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"'"$T"' X","minutes":601,"category":"rapida"}'

chkb "POST minutes=40.5" 400 'errors con field "minutes"' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"'"$T"' X","minutes":40.5,"category":"rapida"}'
chkb 'POST minutes="40"' 400 'errors con field "minutes"' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"'"$T"' X","minutes":"40","category":"rapida"}'

chkb 'POST favorite="true"' 400 'errors con field "favorite"' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"'"$T"' X","minutes":10,"favorite":"true","category":"rapida"}'

chkb "POST category=postres" 400 'errors con field "category"' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"'"$T"' X","minutes":10,"category":"postres"}'

chkb "POST cuatro campos inválidos" 400 'cuatro entradas: title, minutes, favorite, category' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":"","minutes":0,"favorite":"si","category":"x"}'

chkb "POST JSON mal formado" 400 '{"error":"Bad request"}' "" \
  -X POST "$BASE/recipes" -H "$CT" -d '{"title":'

chkb "POST con id del cliente y campo desconocido" 201 'id generado por el servidor (≠ 999999), sin "color"' "" \
  -X POST "$BASE/recipes" -H "$CT" \
  -d '{"id":999999,"color":"rojo","title":"'"$T"' Ident","minutes":5,"category":"rapida"}'
echo "        location: $(location)"
ID=$(idloc)
chkb "GET de la receta creada con id del cliente" 200 'mismo id que Location, sin "color"' "" "$BASE/recipes/$ID"

# ---------- 2. GET /recipes/:id ----------
seccion "2. GET /recipes/:id"

G=$(crear '{"title":"'"$T"' Leer","minutes":15,"category":"entrante"}')
chkb "GET receta existente" 200 \
  '{"title":"<T> Leer","minutes":15,"favorite":false,"category":"entrante","id":'"$G"'}' "" "$BASE/recipes/$G"

GONE=$(crear '{"title":"'"$T"' Borrar","minutes":5,"category":"rapida"}')
curl -s -o /dev/null -X DELETE "$BASE/recipes/$GONE"
chk "GET id inexistente" 404 "$BASE/recipes/$GONE"
chk "GET id no numérico" 404 "$BASE/recipes/abc"

# ---------- 3. PUT /recipes/:id ----------
seccion "3. PUT /recipes/:id"

P=$(crear '{"title":"'"$T"' Put","minutes":25,"favorite":true,"category":"postre"}')
chkb "PUT completo sustituye y conserva id" 200 \
  '{"title":"<T> Put2","minutes":30,"favorite":true,"category":"principal","id":'"$P"'}' "" \
  -X PUT "$BASE/recipes/$P" -H "$CT" -d '{"title":"'"$T"' Put2","minutes":30,"favorite":true,"category":"principal"}'

chkb "PUT sin favorite lo restablece" 200 '"favorite":false' "" \
  -X PUT "$BASE/recipes/$P" -H "$CT" -d '{"title":"'"$T"' Put3","minutes":30,"category":"principal"}'

chkb "PUT incompleto" 400 'errors con field "minutes" y "category"' "" \
  -X PUT "$BASE/recipes/$P" -H "$CT" -d '{"title":"'"$T"' Incompleta"}'
chkb "GET tras PUT rechazado" 200 'sigue "title":"<T> Put3"' "" "$BASE/recipes/$P"

chkb "PUT con otro id en el cuerpo" 200 '"id":'"$P" "" \
  -X PUT "$BASE/recipes/$P" -H "$CT" -d '{"id":999999,"title":"'"$T"' Put4","minutes":30,"category":"principal"}'

chkb "PUT con campo desconocido" 200 'sin "color"' "" \
  -X PUT "$BASE/recipes/$P" -H "$CT" -d '{"color":"rojo","title":"'"$T"' Put5","minutes":30,"category":"principal"}'

chk "PUT id inexistente" 404 \
  -X PUT "$BASE/recipes/$GONE" -H "$CT" -d '{"title":"'"$T"' X","minutes":5,"category":"rapida"}'
chk "PUT id no numérico" 404 \
  -X PUT "$BASE/recipes/abc" -H "$CT" -d '{"title":"'"$T"' X","minutes":5,"category":"rapida"}'

chkb "PUT JSON mal formado" 400 '{"error":"Bad request"}' "" \
  -X PUT "$BASE/recipes/$P" -H "$CT" -d '{"title":'

# ---------- 4. PATCH /recipes/:id ----------
seccion "4. PATCH /recipes/:id"

Q=$(crear '{"title":"'"$T"' Patch","minutes":25,"favorite":true,"category":"postre"}')
chkb "PATCH cambia solo minutes" 200 \
  '{"title":"<T> Patch","minutes":45,"favorite":true,"category":"postre","id":'"$Q"'}' "" \
  -X PATCH "$BASE/recipes/$Q" -H "$CT" -d '{"minutes":45}'

chkb "PATCH recorta espacios del título" 200 '"title":"<T> Patch2"; resto sin cambios' "" \
  -X PATCH "$BASE/recipes/$Q" -H "$CT" -d '{"title":"  '"$T"' Patch2  "}'

chk "PATCH cuerpo vacío" 400 -X PATCH "$BASE/recipes/$Q" -H "$CT" -d '{}'
chk "PATCH solo campos desconocidos" 400 -X PATCH "$BASE/recipes/$Q" -H "$CT" -d '{"color":"rojo"}'

chkb "PATCH minutes=0" 400 'errors con field "minutes"' "" \
  -X PATCH "$BASE/recipes/$Q" -H "$CT" -d '{"minutes":0}'
chkb 'PATCH favorite="no"' 400 'errors con field "favorite"' "" \
  -X PATCH "$BASE/recipes/$Q" -H "$CT" -d '{"favorite":"no"}'
chkb "GET tras PATCH rechazados" 200 'minutes 45 y favorite true' "" "$BASE/recipes/$Q"

chkb "PATCH campo válido + desconocido" 200 '"favorite":false, sin "color"' "" \
  -X PATCH "$BASE/recipes/$Q" -H "$CT" -d '{"favorite":false,"color":"rojo"}'

chk "PATCH id inexistente" 404 -X PATCH "$BASE/recipes/$GONE" -H "$CT" -d '{"minutes":5}'
chk "PATCH id no numérico" 404 -X PATCH "$BASE/recipes/abc" -H "$CT" -d '{"minutes":5}'
chkb "PATCH JSON mal formado" 400 '{"error":"Bad request"}' "" \
  -X PATCH "$BASE/recipes/$Q" -H "$CT" -d '{"minutes":'

# ---------- 5. PUT frente a PATCH ----------
seccion "5. PUT frente a PATCH"

A=$(crear '{"title":"'"$T"' CmpA","minutes":20,"favorite":true,"category":"postre"}')
B=$(crear '{"title":"'"$T"' CmpB","minutes":20,"favorite":true,"category":"postre"}')

chkb "PUT parcial {minutes:15}" 400 'errors con field "title" y "category"' "" \
  -X PUT "$BASE/recipes/$A" -H "$CT" -d '{"minutes":15}'
chkb "PATCH parcial {minutes:15}" 200 'minutes 15, resto sin cambios' "" \
  -X PATCH "$BASE/recipes/$B" -H "$CT" -d '{"minutes":15}'

chkb "PUT sin favorite (A)" 200 '"favorite":false' "" \
  -X PUT "$BASE/recipes/$A" -H "$CT" -d '{"title":"'"$T"' CmpA","minutes":15,"category":"postre"}'
chkb "PATCH sin favorite (B)" 200 '"favorite":true' "" \
  -X PATCH "$BASE/recipes/$B" -H "$CT" -d '{"title":"'"$T"' CmpB","minutes":15,"category":"postre"}'

# ---------- 6. DELETE /recipes/:id ----------
seccion "6. DELETE /recipes/:id"

D=$(crear '{"title":"'"$T"' Del","minutes":5,"category":"rapida"}')
chkb "DELETE existente" 204 'sin cuerpo' "" -X DELETE "$BASE/recipes/$D"
chk "GET tras DELETE" 404 "$BASE/recipes/$D"
chk "DELETE repetido" 404 -X DELETE "$BASE/recipes/$D"
chk "DELETE id no numérico" 404 -X DELETE "$BASE/recipes/abc"

# ---------- 7. Filtros ----------
seccion "7. Filtros"

R1=$(crear '{"title":"'"$T"' Alfa","minutes":30,"favorite":true,"category":"postre"}')
R2=$(crear '{"title":"'"$T"' Bravo","minutes":10,"favorite":false,"category":"postre"}')
R3=$(crear '{"title":"'"$T"' Charlie","minutes":50,"favorite":true,"category":"principal"}')
R4=$(crear '{"title":"'"$T"' Delta","minutes":20,"favorite":true,"category":"postre"}')
echo "        ids creados: R1=$R1 R2=$R2 R3=$R3 R4=$R4"

chkb "search parcial y sin mayúsculas" 200 "[$R1]" 'map(.id)' \
  -G "$BASE/recipes" --data-urlencode "search=$TU AL"

chkb "search + category=postre + sort=id" 200 "[$R1,$R2,$R4]" 'map(.id)' \
  -G "$BASE/recipes" --data-urlencode "search=$TU" --data-urlencode "category=postre" -d "sort=id"

chkb "search del token completo" 200 'títulos del token, ordenados por id' 'map(.title|split(" ")|last)' \
  -G "$BASE/recipes" --data-urlencode "search=$T "

chkb "search sin coincidencias" 200 '[]' "" \
  -G "$BASE/recipes" --data-urlencode "search=${T}zzz-nada"

chkb "search + category + favorite" 200 "[$R1,$R4]" 'map(.id)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d category=postre -d favorite=true

chkb "search + favorite=false + category=postre" 200 "[$R2]" 'map(.id)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d favorite=false -d category=postre

chkb "search + category=principal" 200 'recetas principal del token (Charlie, Max, Put5)' 'map(.title|split(" ")|last)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d category=principal

# ---------- 8. Ordenación ----------
seccion "8. Ordenación"

chkb "sort=minutes asc (postre)" 200 'Bravo(10), Delta(20), Alfa(30) en ese orden relativo; minutes no decreciente' \
  'map(.title|split(" ")|last)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d category=postre -d sort=minutes

chkb "sort=minutes desc" 200 'minutes no creciente' 'map(.minutes)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d sort=minutes -d order=desc

chkb "sort=title asc" 200 '["Alfa","Delta"]' 'map(.title|split(" ")|last)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d category=postre -d favorite=true -d sort=title
chkb "sort=title desc" 200 '["Delta","Alfa"]' 'map(.title|split(" ")|last)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d category=postre -d favorite=true -d sort=title -d order=desc

chkb "order=desc sin sort (por id)" 200 "[$R4,$R1]" 'map(.id)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d category=postre -d favorite=true -d order=desc

# ---------- 9. Paginación ----------
seccion "9. Paginación"

chkb "limit=2 tras filtrar y ordenar" 200 '["CmpB","Delta"]' 'map(.title|split(" ")|last)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d category=postre -d favorite=true -d sort=minutes -d limit=2
chkb "limit=2&offset=1" 200 '["Delta","Alfa"]' 'map(.title|split(" ")|last)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d category=postre -d favorite=true -d sort=minutes -d limit=2 -d offset=1
chkb "offset=2 sin limit" 200 '["Alfa"]' 'map(.title|split(" ")|last)' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d category=postre -d favorite=true -d sort=minutes -d offset=2
chkb "offset más allá del final" 200 '[]' "" \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d offset=1000
chkb "limit=1" 200 'longitud 1' 'length' \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d limit=1
chk "limit=100" 200 "$BASE/recipes?limit=100"

# ---------- 10. Parámetros inválidos ----------
seccion "10. Parámetros de consulta inválidos"

chkb "ejemplo del contrato (foo, sort, limit)" 400 \
  '3 entradas: foo "unknown query parameter", sort "sort must be one of: ...", limit "limit must be an integer between 1 and 100" (cualquier orden)' "" \
  "$BASE/recipes?limit=abc&sort=color&foo=1"

for v in 0 101 1.5 -3; do
  chkb "limit=$v" 400 'field "limit", "limit must be an integer between 1 and 100"' "" "$BASE/recipes?limit=$v"
done

chkb "offset=-1" 400 'field "offset"' "" "$BASE/recipes?offset=-1"
chkb "offset=abc" 400 'field "offset"' "" "$BASE/recipes?offset=abc"

chkb "favorite, category, sort y order inválidos" 400 '4 entradas: favorite, category, sort, order' "" \
  "$BASE/recipes?favorite=yes&category=postres&sort=color&order=up"

chkb "limit repetido" 400 'field "limit"' "" "$BASE/recipes?limit=1&limit=2"
chkb "search repetido" 400 'field "search"' "" "$BASE/recipes?search=a&search=b"

chkb "search válido + limit=0" 400 'field "limit", sin array de recetas' "" \
  -G "$BASE/recipes" --data-urlencode "search=$T " -d limit=0

chk "el servidor sigue respondiendo" 200 "$BASE/recipes"

# ---------- 11. GET /recipes/stats ----------
seccion "11. GET /recipes/stats"

chkb "forma del resumen" 200 \
  'total, favorites, averageMinutes numéricos; byCategory con entrante, principal, postre, vegetariano, rapida' "" \
  "$BASE/recipes/stats"

chkb "coherencia: colección" 200 'total y favorites iguales a los de stats' \
  '{total:length, favorites:(map(select(.favorite))|length)}' "$BASE/recipes"
chkb "coherencia: stats" 200 'sumaCat igual a total' \
  '{total, favorites, sumaCat:([.byCategory[]]|add)}' "$BASE/recipes/stats"

F='[.total,.favorites,.byCategory.rapida]'
chkb "stats antes de crear (S0)" 200 '[total, favorites, rapida]' "$F" "$BASE/recipes/stats"
S0=$(jq -c "$F" "$BODY" 2>/dev/null)
X=$(crear '{"title":"'"$T"' Stats","minutes":600,"favorite":true,"category":"rapida"}')
chkb "stats tras crear (S1)" 200 'S0 con cada valor +1' "$F" "$BASE/recipes/stats"
S1=$(jq -c "$F" "$BODY" 2>/dev/null)
curl -s -o /dev/null -X DELETE "$BASE/recipes/$X"
chkb "stats tras borrar (S2)" 200 'igual a S0' "$F" "$BASE/recipes/stats"
S2=$(jq -c "$F" "$BODY" 2>/dev/null)
echo "        S0=$S0  S1=$S1  S2=$S2"

# ---------- 12. Respuestas globales ----------
seccion "12. Respuestas globales"

chkb "ruta inexistente" 404 '{"error":"Route not found"}' "" "$BASE/recetas"

# ---------- resumen ----------
printf '\nResumen de códigos: %d OK, %d FALLA\n' "$OKS" "$FALLAS"
echo "Las líneas con 'cuerpo:' hay que revisarlas a mano comparándolas con 'esperado:'."