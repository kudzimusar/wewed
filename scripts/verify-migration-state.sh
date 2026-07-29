#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DATABASE_URL="${WEWED_STAGING_DATABASE_URL:-${DATABASE_URL:-}}"
export DIRECT_URL="$DATABASE_URL"
"$ROOT_DIR/scripts/assert-staging-db.sh"
bunx prisma migrate status --schema "$ROOT_DIR/prisma/schema.prisma"
bunx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel "$ROOT_DIR/prisma/schema.prisma" --exit-code
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "select migration_name, finished_at from staging._prisma_migrations where rolled_back_at is null order by started_at"
