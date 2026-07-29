#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DATABASE_URL="${WEWED_STAGING_DATABASE_URL:-${DATABASE_URL:-}}"
"$ROOT_DIR/scripts/assert-staging-db.sh"

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables
           WHERE schemaname='staging'
             AND tablename NOT IN ('_wewed_environment','_prisma_migrations')
  LOOP
    EXECUTE format('TRUNCATE TABLE staging.%I RESTART IDENTITY CASCADE', r.tablename);
  END LOOP;
END $$;
COMMIT;
SQL

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$ROOT_DIR/scripts/staging-seed.sql"
echo "Wewed staging tenant reset and reseeded."
