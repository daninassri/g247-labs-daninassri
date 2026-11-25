#!/usr/bin/env bash
# Aplica en orden las migraciones SQL numeradas de db/migrations/.
# Usa DATABASE_URL (del entorno o del fichero .env). Son idempotentes (IF NOT EXISTS).
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${DATABASE_URL:?DATABASE_URL is required}"
for f in db/migrations/*.sql; do
  echo "Aplicando $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done
echo "Migraciones aplicadas."
