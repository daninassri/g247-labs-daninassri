#!/usr/bin/env bash
# tester-script.sh — Pruebas de caja negra de la API de recetas (según el contrato).
# Uso:  bash tester-script.sh          (BASE=http://otra:puerto bash tester-script.sh)
# Requiere: curl y jq. Opcional: psql + DATABASE_URL para borrar los usuarios de prueba.

set -o pipefail

BASE="${BASE:-http://localhost:3000}"
CT='Content-Type: application/json'
RUN="$(date +%s)$RANDOM"
U="qa$RUN"                      # prefijo único de títulos y correos
TMP=$(mktemp -d)

TOTAL=0; OKS=0; FAILS=0
CREATED_IDS=(); CREATED_TOK=(); REGISTERED=()
ADMIN=""; ANA=""; BEN=""; CARLA=""
ADMIN_ID=null; ANA_ID=null; BEN_ID=null; CARLA_ID=null
R=null; R2=null; P=null; GONE=null; T0=null; F0=null; LIDS=null
A1=""; A2=""

if [[ -t 1 ]]; then C_OK=$'\e[32m'; C_KO=$'\e[31m'; C_W=$'\e[33m'; C_N=$'\e[0m'; else C_OK=; C_KO=; C_W=; C_N=; fi

# ---------------------------------------------------------------- utilidades
for c in curl jq; do command -v "$c" >/dev/null || { echo "Falta '$c'. Instálalo (sudo apt install $c)."; exit 2; }; done

# req MÉTODO RUTA [AUTH] [CUERPO]
#   AUTH: ""            -> sin cabecera Authorization
#         "H:<cabecera>" -> cabecera literal (para probar formatos raros)
#         "<token>"      -> Authorization: Bearer <token>
# Deja STATUS, BODY y LOCATION. Registra recetas creadas y usuarios registrados.
req() {
  local m=$1 p=$2 auth=${3:-} data=${4:-}
  local a=(-s -X "$m" -D "$TMP/h" -o "$TMP/b" -w '%{http_code}' --max-time 15)
  case $auth in
    "")  ;;
    H:*) a+=(-H "${auth#H:}") ;;
    *)   a+=(-H "Authorization: Bearer $auth") ;;
  esac
  [[ -n $data ]] && a+=(-H "$CT" --data-raw "$data")
  : >"$TMP/h"; : >"$TMP/b"
  STATUS=$(curl "${a[@]}" "$BASE$p" 2>/dev/null) || true
  [[ -z $STATUS ]] && STATUS=000
  BODY=$(cat "$TMP/b")
  LOCATION=$(grep -i '^location:' "$TMP/h" | tail -1 | cut -d' ' -f2- | tr -d '\r')
  if [[ $m == POST && $p == /recipes && $STATUS == 201 ]]; then
    local id; id=$(jq -r '.id // empty' <<<"$BODY" 2>/dev/null)
    if [[ -n $id ]]; then CREATED_IDS+=("$id"); CREATED_TOK+=("$auth"); fi
  fi
  if [[ $m == POST && $p == /auth/register && $STATUS == 201 ]]; then
    REGISTERED+=("$(jq -r '.email // "?"' <<<"$BODY" 2>/dev/null)")
  fi
}

JQDEFS='
def abs: if . < 0 then -. else . end;
def nopass: ([paths | .[-1] | strings | select(test("pass"; "i"))] | length) == 0;
def haserr($xs): (.errors | type) == "array"
  and all(.errors[]; has("field") and has("message"))
  and ([.errors[].field] as $f | all($xs[]; . as $x | any($f[]; . == $x)));
def onlyerr($x): (.errors | type) == "array" and (.errors | length) >= 1
  and all(.errors[]; .field == $x and has("message"));
'

# check NOMBRE ESTADO_ESPERADO [FILTRO_JQ | EMPTY] [CONDICIÓN_EXTRA(1/0)]
check() {
  local name=$1 exp=$2 f=${3:-} extra=${4:-1} ok=1 why=""
  TOTAL=$((TOTAL + 1))
  [[ $STATUS == "$exp" ]] || { ok=0; why="estado"; }
  if [[ -n $f ]]; then
    if [[ $f == EMPTY ]]; then
      [[ -z $BODY ]] || { ok=0; why+=" cuerpo-no-vacío"; }
    elif ! jq -e \
        --arg U "$U" --arg A1 "$A1" --arg A2 "$A2" \
        --argjson ANA "$ANA_ID" --argjson BEN "$BEN_ID" --argjson ADMIN "$ADMIN_ID" --argjson CARLA "$CARLA_ID" \
        --argjson R "$R" --argjson R2 "$R2" --argjson P "$P" --argjson GONE "$GONE" \
        --argjson T0 "$T0" --argjson F0 "$F0" --argjson LIDS "$LIDS" \
        "$JQDEFS ($f) == true" >/dev/null 2>&1 <<<"$BODY"; then
      ok=0; why+=" cuerpo"
    fi
  fi
  [[ $extra == 1 ]] || { ok=0; why+=" cabecera"; }
  if ((ok)); then
    OKS=$((OKS + 1))
    printf '%s[OK]   %s %-62s esperado=%s real=%s\n' "$C_OK" "$C_N" "$name" "$exp" "$STATUS"
  else
    FAILS=$((FAILS + 1))
    printf '%s[FALLA]%s %-62s esperado=%s real=%s  (%s)\n' "$C_KO" "$C_N" "$name" "$exp" "$STATUS" "${why# }"
    printf '         cuerpo: %.300s\n' "$(tr -d '\n' <<<"$BODY")"
  fi
}

section() { printf '\n%s== %s%s\n' "$C_W" "$1" "$C_N"; }

login() { curl -s -X POST "$BASE/auth/login" -H "$CT" --data-raw "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r '.token // empty' 2>/dev/null; }
meid()  { curl -s "$BASE/auth/me" -H "Authorization: Bearer $1" | jq '.id // null' 2>/dev/null; }
b64()   { printf '%s' "$1" | base64 | tr -d '=\n' | tr '/+' '_-'; }

# ---------------------------------------------------------------- limpieza (trap EXIT)
cleanup() {
  local rc=$? i id tok st del=0 gone=0 left=()
  trap - EXIT
  section "Limpieza"
  for i in "${!CREATED_IDS[@]}"; do
    id=${CREATED_IDS[$i]}; tok=${CREATED_TOK[$i]}; st=000
    if [[ -n $tok && $tok != H:* ]]; then
      st=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X DELETE -H "Authorization: Bearer $tok" "$BASE/recipes/$id")
    fi
    if [[ $st != 204 && $st != 404 && -n $ADMIN ]]; then
      st=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X DELETE -H "Authorization: Bearer $ADMIN" "$BASE/recipes/$id")
    fi
    case $st in 204) del=$((del + 1)) ;; 404) gone=$((gone + 1)) ;; *) left+=("$id") ;; esac
  done
  echo "Recetas creadas: ${#CREATED_IDS[@]} | borradas ahora: $del | ya borradas por las pruebas: $gone"
  ((${#left[@]})) && echo "${C_KO}AVISO:${C_N} no se pudieron borrar las recetas: ${left[*]}"

  if command -v psql >/dev/null && [[ -n ${DATABASE_URL:-} ]]; then
    if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DELETE FROM users WHERE email LIKE '${U}-%';"; then
      echo "Usuarios de prueba (${U}-*) borrados."
    else
      echo "${C_KO}AVISO:${C_N} falló psql; quedan usuarios de prueba con correo ${U}-*"
    fi
  elif ((${#REGISTERED[@]})); then
    echo "${C_W}AVISO:${C_N} psql o DATABASE_URL no disponibles. Quedan ${#REGISTERED[@]} usuarios de prueba:"
    printf '   %s\n' "${REGISTERED[@]}"
    echo "   Para borrarlos: psql \"\$DATABASE_URL\" -c \"DELETE FROM users WHERE email LIKE '${U}-%';\""
  fi
  rm -rf "$TMP"

  section "Resumen"
  echo "Total: $TOTAL | ${C_OK}OK: $OKS${C_N} | ${C_KO}FALLA: $FAILS${C_N}"
  if ((rc == 0 && FAILS > 0)); then rc=1; fi
  exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ---------------------------------------------------------------- 0. preparación
echo "BASE=$BASE  token de ejecución=$U"
req GET /recipes/stats
[[ $STATUS == 000 ]] && { echo "${C_KO}La API no responde en $BASE${C_N}"; exit 2; }

ADMIN=$(login admin@example.com Admin1234); ANA=$(login ana@example.com Demo1234); BEN=$(login ben@example.com Demo1234)
[[ -n $ADMIN && -n $ANA && -n $BEN ]] || { echo "${C_KO}No se pudo obtener el token de algún usuario de demostración${C_N}"; exit 2; }
ADMIN_ID=$(meid "$ADMIN"); ANA_ID=$(meid "$ANA"); BEN_ID=$(meid "$BEN")
[[ $ADMIN_ID =~ ^[0-9]+$ && $ANA_ID =~ ^[0-9]+$ && $BEN_ID =~ ^[0-9]+$ ]] || { echo "${C_KO}/auth/me no devolvió ids numéricos${C_N}"; exit 2; }
echo "ids: admin=$ADMIN_ID ana=$ANA_ID ben=$BEN_ID"

# ---------------------------------------------------------------- 1. registro
section "1. Registro"
E_CARLA="$U-carla@example.test"
req POST /auth/register "" '{"email":"'"$E_CARLA"'","password":"Carla1234"}'
check "1.1 registro correcto" 201 '(.id|type)=="number" and .email=="\($U)-carla@example.test" and nopass'
CARLA_ID=$(jq '.id // null' <<<"$BODY" 2>/dev/null); [[ $CARLA_ID =~ ^[0-9]+$ ]] || CARLA_ID=null
CARLA=$(login "$E_CARLA" Carla1234)

req POST /auth/register "" '{"email":"'"$U"'-rol@example.test","password":"Rol12345","role":"admin"}'
check "1.2a registro con role:admin en el cuerpo" 201 '(.id|type)=="number" and has("email") and nopass'
req GET /auth/me "$(login "$U-rol@example.test" Rol12345)"
check "1.2b el rol enviado se ignora (role=user)" 200 '.role=="user"'

req POST /auth/register "" '{"email":"'"$E_CARLA"'","password":"Otra12345"}'
check "1.3 correo duplicado" 409

req POST /auth/register "" '{"email":"no-es-un-correo","password":"Valida123"}'
check "1.4 correo con formato inválido" 400

req POST /auth/register "" '{"email":"'"$U"'-p7@example.test","password":"Abc1234"}'
check "1.5 contraseña de 7 caracteres" 400

req POST /auth/register "" '{"email":"'"$U"'-p8@example.test","password":"Abcd1234"}'
check "1.6 contraseña de 8 caracteres" 201 '(.id|type)=="number" and has("email") and nopass'

P72=$(printf 'a%.0s' {1..72}); P73=$(printf 'a%.0s' {1..73})
req POST /auth/register "" '{"email":"'"$U"'-p72@example.test","password":"'"$P72"'"}'
check "1.7a contraseña de 72 bytes" 201 '(.id|type)=="number" and nopass'
req POST /auth/register "" '{"email":"'"$U"'-p73@example.test","password":"'"$P73"'"}'
check "1.7b contraseña de 73 bytes" 400

NY=$'\xc3\xb1'; N36=""; for _ in {1..36}; do N36+=$NY; done; N37="$N36$NY"
req POST /auth/register "" '{"email":"'"$U"'-n36@example.test","password":"'"$N36"'"}'
check "1.8a 36 'ñ' = 72 bytes" 201 '(.id|type)=="number" and nopass'
req POST /auth/register "" '{"email":"'"$U"'-n37@example.test","password":"'"$N37"'"}'
check "1.8b 37 'ñ' = 74 bytes" 400

req POST /auth/register "" '{"email":"'"$U"'-x@example.test"}'
check "1.9a registro sin contraseña" 400
req POST /auth/register "" '{"email":12345,"password":"Valida123"}'
check "1.9b registro con email que no es texto" 400

# ---------------------------------------------------------------- 2. acceso y /auth/me
section "2. Acceso y /auth/me"
req POST /auth/login "" '{"email":"ana@example.com","password":"Demo1234"}'
check "2.1 acceso correcto" 200 '(.token|type)=="string" and (.token|split(".")|length)==3'

req POST /auth/login "" '{"email":"ana@example.com","password":"Mala12345"}'
check "2.2a contraseña incorrecta" 401
req POST /auth/login "" '{"email":"'"$U"'-nadie@example.test","password":"Demo1234"}'
check "2.2b correo inexistente" 401

req POST /auth/login "" '{"email":"no-es-correo","password":"x"}'
check "2.3 email mal formado pero texto -> 401, no 400" 401

req POST /auth/login "" '{"email":"ana@example.com"}'
check "2.4a acceso sin contraseña" 400
req POST /auth/login "" '{"email":["ana@example.com"],"password":"Demo1234"}'
check "2.4b acceso con email que no es texto" 400

req POST /auth/login "" '{"email":"ana@example.com",'
check "2.5 acceso con JSON inválido" 400 '.error=="Bad request"'

req GET /auth/me "$ANA"
check "2.6 /auth/me con token válido" 200 '.id==$ANA and .email=="ana@example.com" and .role=="user" and nopass'

# ---------------------------------------------------------------- 3. tokens
section "3. Tokens ausentes, mal formados o inválidos"
AUTHS=("" "H:Authorization: Bearer" "H:Authorization: Bearer " "H:Authorization: $ANA" "H:Authorization: Basic YW5hOkRlbW8xMjM0" "H:Authorization: Bearer basura.no.jwt")
ANAMES=("sin cabecera" "Bearer vacío" "Bearer + espacio" "token sin prefijo Bearer" "esquema Basic" "Bearer con texto no JWT")
NOTOK='{"title":"'"$U"' notok","minutes":5,"category":"rapida"}'
for i in "${!AUTHS[@]}"; do
  req GET /auth/me "${AUTHS[$i]}";            check "3.1 me   - ${ANAMES[$i]}" 401
  req POST /recipes "${AUTHS[$i]}" "$NOTOK";  check "3.1 post - ${ANAMES[$i]}" 401
done

BADSIG="${ANA%.*}.firmafalsa"
FORGED="$(cut -d. -f1 <<<"$ANA").$(b64 '{"id":'"$ADMIN_ID"',"role":"admin"}').$(cut -d. -f3 <<<"$ANA")"
NONE="$(b64 '{"alg":"none","typ":"JWT"}').$(b64 '{"id":'"$ADMIN_ID"',"role":"admin"}')."
req GET /auth/me "$BADSIG"; check "3.2a firma alterada" 401
req GET /auth/me "$FORGED"; check "3.2b payload falsificado con firma original" 401
req GET /auth/me "$NONE";   check "3.2c token alg:none" 401

# ---------------------------------------------------------------- 4. crear
section "4. Crear recetas (POST)"
req POST /recipes "$ANA" '{"title":"   '"$U"' pisto   ","minutes":40,"category":"vegetariano"}'
R=$(jq '.id // null' <<<"$BODY" 2>/dev/null); [[ $R =~ ^[0-9]+$ ]] || R=null
LOC_OK=0; [[ $R != null && $LOCATION == */recipes/$R ]] && LOC_OK=1
check "4.1 crear: 201 + Location + recorte + favorite=false" 201 \
  '.id==$R and .title=="\($U) pisto" and .minutes==40 and .favorite==false and .category=="vegetariano" and .userId==$ANA' "$LOC_OK"

req POST /recipes "$ANA" '{"id":999999,"userId":'"$BEN_ID"',"title":"'"$U"' ignora","minutes":10,"category":"rapida","color":"rojo"}'
check "4.2a se ignoran id/userId del cliente y campos desconocidos" 201 \
  '(.id|type)=="number" and .id!=999999 and .userId==$ANA and (has("color")|not)'
R2=$(jq '.id // null' <<<"$BODY" 2>/dev/null); [[ $R2 =~ ^[0-9]+$ ]] || R2=null
req GET "/recipes/$R2"
check "4.2b el GET tampoco tiene color y conserva el dueño" 200 '.id==$R2 and .userId==$ANA and (has("color")|not)'

req POST /recipes "$ANA" '{"title":"'"$U"' min1","minutes":1,"favorite":true,"category":"entrante"}'
check "4.3a minutes=1 y favorite=true" 201 '.minutes==1 and .favorite==true'
req POST /recipes "$ANA" '{"title":"'"$U"' min600","minutes":600,"category":"principal"}'
check "4.3b minutes=600 y favorite por defecto" 201 '.minutes==600 and .favorite==false'

req POST /recipes "$ANA" '{}'
check "4.4 cuerpo vacío: todas las incidencias a la vez" 400 'haserr(["title","minutes","category"])'

req POST /recipes "$ANA" '{"title":"","minutes":0,"favorite":"si","category":"sopa"}'
check "4.5 cuatro campos inválidos" 400 'haserr(["title","minutes","favorite","category"])'

for M in 601 -5 40.5; do
  req POST /recipes "$ANA" '{"title":"'"$U"' m","minutes":'"$M"',"category":"postre"}'
  check "4.6 minutes=$M" 400 'haserr(["minutes"])'
done

req POST /recipes "" '{"title":"'"$U"' anon","minutes":5,"category":"rapida"}'
check "4.7a crear sin token" 401
req POST /recipes "$ANA" '{"title": '
check "4.7b crear con JSON inválido" 400 '.error=="Bad request"'

# ---------------------------------------------------------------- 5. lecturas
section "5. Lecturas públicas y 404"
req GET "/recipes/$R"
check "5.1 GET receta sin token" 200 '.id==$R and .title=="\($U) pisto" and .userId==$ANA'

req POST /recipes "$ANA" '{"title":"'"$U"' gone","minutes":5,"category":"rapida"}'
GONE=$(jq '.id // null' <<<"$BODY" 2>/dev/null); [[ $GONE =~ ^[0-9]+$ ]] || GONE=null
req DELETE "/recipes/$GONE" "$ANA"
req GET "/recipes/$GONE"
check "5.2 receta inexistente (creada y borrada)" 404

req GET /no-existe
check "5.3 ruta inexistente" 404 '.error=="Route not found"'

# ---------------------------------------------------------------- 6. PUT vs PATCH
section "6. PUT frente a PATCH"
req POST /recipes "$ANA" '{"title":"'"$U"' base","minutes":30,"favorite":true,"category":"postre"}'
check "6.1 receta base con favorite=true" 201 '.favorite==true and .userId==$ANA'
P=$(jq '.id // null' <<<"$BODY" 2>/dev/null); [[ $P =~ ^[0-9]+$ ]] || P=null

req PATCH "/recipes/$P" "$ANA" '{"minutes":45}'
check "6.2 PATCH cambia solo minutes" 200 '.minutes==45 and .title=="\($U) base" and .favorite==true and .category=="postre"'

req PUT "/recipes/$P" "$ANA" '{"title":"'"$U"' put","minutes":20,"category":"principal"}'
check "6.3 PUT sin favorite lo devuelve a false" 200 \
  '.id==$P and .title=="\($U) put" and .minutes==20 and .favorite==false and .category=="principal" and .userId==$ANA'

req PUT "/recipes/$P" "$ANA" '{"minutes":20}'
check "6.4 PUT valida el cuerpo completo" 400 'haserr(["title","category"])'

req PATCH "/recipes/$P" "$ANA" '{"minutes":700}'; check "6.5a PATCH minutes=700" 400 'onlyerr("minutes")'
req PATCH "/recipes/$P" "$ANA" '{"title":""}';    check "6.5b PATCH title vacío" 400 'onlyerr("title")'
req PATCH "/recipes/$P" "$ANA" '{"favorite":"si"}'; check "6.5c PATCH favorite=\"si\"" 400 'onlyerr("favorite")'

req PATCH "/recipes/$P" "$ANA" '{}';               check "6.6a PATCH vacío" 400
req PATCH "/recipes/$P" "$ANA" '{"color":"rojo"}'; check "6.6b PATCH solo con campo desconocido" 400

req PATCH "/recipes/$P" "$ANA" '{"title":"  '"$U"' patch  ","userId":'"$BEN_ID"'}'
check "6.7 PATCH recorta el título e ignora userId" 200 '.title=="\($U) patch" and .userId==$ANA'

req PUT "/recipes/$P" "$ANA" '{"id":999999,"userId":'"$BEN_ID"',"title":"'"$U"' put2","minutes":15,"category":"rapida","foo":1}'
check "6.8 PUT ignora id/userId/campos desconocidos" 200 \
  '.id==$P and .userId==$ANA and (has("foo")|not) and .title=="\($U) put2" and .minutes==15'

req PUT "/recipes/$GONE" "$ANA" '{"title":"'"$U"' x","minutes":5,"category":"rapida"}'; check "6.9a PUT a receta inexistente" 404
req PATCH "/recipes/$GONE" "$ANA" '{"minutes":5}';                                     check "6.9b PATCH a receta inexistente" 404

# ---------------------------------------------------------------- 7. permisos
section "7. Permisos (receta P de ana)"
req GET "/recipes/$P";                                                                 check "7.1 anónimo GET" 200 '.id==$P'
req PUT "/recipes/$P" "" '{"title":"'"$U"' a","minutes":5,"category":"rapida"}';      check "7.1 anónimo PUT" 401
req PATCH "/recipes/$P" "" '{"minutes":5}';                                            check "7.1 anónimo PATCH" 401
req DELETE "/recipes/$P";                                                              check "7.1 anónimo DELETE" 401

req PUT "/recipes/$P" "$BEN" '{"title":"'"$U"' ben","minutes":5,"category":"rapida"}'; check "7.2 otro usuario PUT" 403
req PATCH "/recipes/$P" "$BEN" '{"minutes":5}';                                         check "7.2 otro usuario PATCH" 403
req DELETE "/recipes/$P" "$BEN";                                                        check "7.2 otro usuario DELETE" 403
req GET "/recipes/$P"
check "7.2 la receta no cambió" 200 '.title=="\($U) put2" and .minutes==15 and .userId==$ANA'

req PATCH "/recipes/$P" "$ADMIN" '{"favorite":true}'
check "7.3a admin PATCH, el dueño no cambia" 200 '.favorite==true and .userId==$ANA'
req PUT "/recipes/$P" "$ADMIN" '{"title":"'"$U"' admin","minutes":25,"category":"entrante","userId":'"$ADMIN_ID"'}'
check "7.3b admin PUT, el dueño no cambia" 200 '.title=="\($U) admin" and .favorite==false and .userId==$ANA'

req DELETE "/recipes/$R2" "$ANA";   check "7.4a la propietaria borra" 204 EMPTY
req GET "/recipes/$R2";             check "7.4b GET tras borrar" 404
req DELETE "/recipes/$R2" "$ANA";   check "7.4c segundo DELETE" 404

req DELETE "/recipes/$P" "$ADMIN";  check "7.5a admin borra receta ajena" 204 EMPTY
req GET "/recipes/$P";              check "7.5b GET tras borrar" 404

# ---------------------------------------------------------------- 8. colección
section "8. Colección: filtros, orden y paginación (recetas de carla)"
L=()
for spec in "alfa 30 false postre" "beta 10 true principal" "gamma 50 true postre" "delta 20 false rapida" "epsilon 40 true entrante"; do
  read -r nm mi fa ca <<<"$spec"
  req POST /recipes "$CARLA" '{"title":"'"$U"'-lst '"$nm"'","minutes":'"$mi"',"favorite":'"$fa"',"category":"'"$ca"'"}'
  check "8.0 carla crea '$nm'" 201 '.userId==$CARLA and .title=="\($U)-lst '"$nm"'"'
  id=$(jq -r '.id // empty' <<<"$BODY" 2>/dev/null); [[ -n $id ]] && L+=("$id")
done
LIDS=$(printf '%s\n' "${L[@]}" | jq -s 'sort'); [[ -n $LIDS ]] || LIDS=null

req GET "/recipes?userId=$CARLA_ID"
check "8.1 valores por defecto" 200 \
  '.page==1 and .limit==10 and .total==5 and (.items|length)==5 and [.items[].id]==$LIDS and all(.items[]; .userId==$CARLA)'

req GET "/recipes?userId=$CARLA_ID&favorite=true&category=postre"
check "8.2 filtros combinados" 200 '.total==1 and [.items[].title]==["\($U)-lst gamma"]'

req GET "/recipes?userId=$CARLA_ID&favorite=true&sort=minutes&order=desc"
check "8.3 filtro + orden desc" 200 '.total==3 and [.items[].minutes]==[50,40,10]'

EXP_PAGES=("[10,20]" "[30,40]" "[50]" "[]")
for p in 1 2 3 4; do
  req GET "/recipes?userId=$CARLA_ID&sort=minutes&limit=2&page=$p"
  check "8.4 paginación page=$p" 200 '.page=='"$p"' and .limit==2 and .total==5 and [.items[].minutes]=='"${EXP_PAGES[$((p-1))]}"
done

req GET "/recipes?search=${U^^}-LST"
check "8.5a search sin distinguir mayúsculas" 200 '.total==5'
req GET "/recipes?search=lst%20GAM"
check "8.5b search parcial" 200 '[.items[] | select(.userId==$CARLA) | .title] | any(. == "\($U)-lst gamma")'

req GET "/recipes?userId=$CARLA_ID&sort=title"
check "8.6a sort=title asc" 200 '[.items[].title|split(" ")[1]]==["alfa","beta","delta","epsilon","gamma"]'
req GET "/recipes?userId=$CARLA_ID&sort=title&order=desc"
check "8.6b sort=title desc" 200 '[.items[].title|split(" ")[1]]==["gamma","epsilon","delta","beta","alfa"]'

req GET "/recipes?userId=$CARLA_ID&sort=category"
check "8.7 sort=category" 200 '[.items[].category]==["entrante","postre","postre","principal","rapida"]'

req GET "/recipes?userId=$CARLA_ID&limit=100&page=100000"
check "8.8a limit=100 y page=100000" 200 '.page==100000 and .limit==100 and .total==5 and (.items|length)==0'
req GET "/recipes?userId=$CARLA_ID&limit=1"
check "8.8b limit=1" 200 '.limit==1 and .total==5 and (.items|length)==1'

# ---------------------------------------------------------------- 9. consultas inválidas
section "9. Parámetros de consulta inválidos"
Q9=(
  "favorite=yes|favorite|" "favorite=|favorite|" "category=sopa|category|"
  "userId=0|userId|" "userId=-3|userId|" "userId=abc|userId|"
  "sort=color|sort|sort must be one of: id, title, minutes, favorite, category"
  "order=up|order|" "page=0|page|" "page=100001|page|"
  "limit=0|limit|" "limit=101|limit|" "limit=2.5|limit|" "limit=1&limit=2|limit|"
  "foo=1|foo|unknown query parameter"
)
for row in "${Q9[@]}"; do
  IFS='|' read -r q A1 A2 <<<"$row"
  req GET "/recipes?$q"
  check "9.1 ?$q" 400 'haserr([$A1]) and (if $A2 == "" then true else any(.errors[]; .field==$A1 and .message==$A2) end)'
done
A1=""; A2=""

req GET "/recipes?limit=abc&sort=color&foo=1"
check "9.2 lista completa de incidencias (ejemplo)" 400 '(.errors|length)==3
  and any(.errors[]; .field=="sort"  and .message=="sort must be one of: id, title, minutes, favorite, category")
  and any(.errors[]; .field=="limit" and .message=="limit must be an integer between 1 and 100")
  and any(.errors[]; .field=="foo"   and .message=="unknown query parameter")'

req GET "/recipes?userId=$CARLA_ID&sort=minutes&order=desc&page=0"
check "9.3 un inválido entre válidos no se ignora" 400 'onlyerr("page")'

# ---------------------------------------------------------------- 10. resumen
section "10. /recipes/stats"
req GET /recipes/stats
check "10.1 forma, redondeo y cinco categorías" 200 \
  'has("total") and has("favorites") and has("averageMinutes") and has("byCategory")
   and ((.averageMinutes*10) - ((.averageMinutes*10 + 0.5)|floor) | abs) < 1e-6
   and ((.byCategory|tostring) as $s | all("entrante","principal","postre","vegetariano","rapida"; . as $c | $s | test($c)))'
T0=$(jq '.total // null' <<<"$BODY" 2>/dev/null); F0=$(jq '.favorites // null' <<<"$BODY" 2>/dev/null)
[[ $T0 =~ ^[0-9]+$ ]] || T0=null; [[ $F0 =~ ^[0-9]+$ ]] || F0=null

req POST /recipes "$ANA" '{"title":"'"$U"' stats","minutes":5,"favorite":true,"category":"rapida"}'
req GET /recipes/stats
check "10.2 stats refleja la receta nueva (+1 total, +1 fav)" 200 '.total==$T0+1 and .favorites==$F0+1'

exit 0