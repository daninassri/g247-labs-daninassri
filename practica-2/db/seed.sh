#!/usr/bin/env bash
# Carga db/seed.sql (vacía las tablas y las rellena). Usa DATABASE_URL.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then set -a; . ./.env; set +a; fi
: "${DATABASE_URL:?DATABASE_URL is required}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f db/seed.sql
echo "Datos iniciales cargados."
