#!/usr/bin/env bash
set -euo pipefail

export CI='true'
export WEWED_E2E_MODE='1'
export NEXT_PUBLIC_SUPABASE_URL='https://example.supabase.co'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='ci-anon-key'
export SUPABASE_SERVICE_ROLE_KEY='ci-service-role-key'
export WEWED_SESSION_SECRET='ci-session-secret-not-for-production'
export NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3000'
export NEXT_TELEMETRY_DISABLED='1'
unset VERCEL
unset VERCEL_ENV

yum install -y postgresql16 postgresql16-server
PG_INITDB="$(find /usr -type f -name initdb 2>/dev/null | head -n 1)"
PG_CTL="$(find /usr -type f -name pg_ctl 2>/dev/null | head -n 1)"
PG_CREATEDB="$(find /usr -type f -name createdb 2>/dev/null | head -n 1)"
PGDATA='/tmp/wewed-postgres'
rm -rf "$PGDATA"
install -d -m 700 -o postgres -g postgres "$PGDATA"
runuser -u postgres -- "$PG_INITDB" -D "$PGDATA" --auth=trust --encoding=UTF8 --no-locale
runuser -u postgres -- "$PG_CTL" -D "$PGDATA" -o '-F -h 127.0.0.1 -p 5432' -w start
trap 'runuser -u postgres -- "$PG_CTL" -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true' EXIT
runuser -u postgres -- "$PG_CREATEDB" -h 127.0.0.1 -p 5432 wewed
export DATABASE_URL='postgresql://postgres@127.0.0.1:5432/wewed?schema=public'
export DIRECT_URL="$DATABASE_URL"

bunx prisma validate --schema prisma/schema.prisma
bunx prisma generate --schema prisma/schema.prisma
bunx prisma migrate deploy --schema prisma/schema.prisma

find . -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) \
  -not -path './node_modules/*' \
  -not -path './.next/*' \
  -not -path './tests/e2e/*' \
  | sort > /tmp/wewed-bun-tests.txt
readarray -t BUN_TEST_FILES < /tmp/wewed-bun-tests.txt
printf 'MAIN BASELINE Bun test files: %s\n' "${#BUN_TEST_FILES[@]}"
bun test "${BUN_TEST_FILES[@]}"
