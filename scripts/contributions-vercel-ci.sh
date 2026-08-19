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

printf '\n== Install disposable PostgreSQL 16 ==\n'
yum install -y postgresql16 postgresql16-server
PG_INITDB="$(find /usr -type f -name initdb 2>/dev/null | head -n 1)"
PG_CTL="$(find /usr -type f -name pg_ctl 2>/dev/null | head -n 1)"
PG_CREATEDB="$(find /usr -type f -name createdb 2>/dev/null | head -n 1)"
if [[ -z "$PG_INITDB" || -z "$PG_CTL" || -z "$PG_CREATEDB" ]]; then
  echo 'PostgreSQL binaries were not installed as expected.' >&2
  exit 1
fi
PGDATA='/tmp/wewed-postgres'
rm -rf "$PGDATA"
install -d -m 700 -o postgres -g postgres "$PGDATA"
runuser -u postgres -- "$PG_INITDB" -D "$PGDATA" --auth=trust --encoding=UTF8 --no-locale
runuser -u postgres -- "$PG_CTL" -D "$PGDATA" -o '-F -h 127.0.0.1 -p 5432' -w start
trap 'runuser -u postgres -- "$PG_CTL" -D "$PGDATA" -m fast -w stop >/dev/null 2>&1 || true' EXIT
runuser -u postgres -- "$PG_CREATEDB" -h 127.0.0.1 -p 5432 wewed
export DATABASE_URL='postgresql://postgres@127.0.0.1:5432/wewed?schema=public'
export DIRECT_URL="$DATABASE_URL"

printf '\n== Apply exact Contributions remediation ==\n'
python3 scripts/contributions-alignment-driver-v11.py

printf '\n== Install CI-only Playwright package ==\n'
bun add --no-save --exact @playwright/test@1.55.0

printf '\n== Validate and migrate disposable PostgreSQL ==\n'
bunx prisma validate --schema prisma/schema.prisma
bunx prisma generate --schema prisma/schema.prisma
bunx prisma migrate deploy --schema prisma/schema.prisma

printf '\n== Run Bun regression against clean-main baseline ==\n'
# These seven files are independently reproduced as broken on clean main in the
# same disposable PostgreSQL environment. Contributions must not add any other
# unit/integration failure. Playwright E2E specs are executed separately below.
BASELINE_BROKEN=(
  './src/app/api/cron/communications-deliveries/route.test.ts'
  './src/app/api/webhooks/whatsapp/route.test.ts'
  './src/lib/communication-channels.test.ts'
  './src/lib/communications-rate-limit.test.ts'
  './src/lib/communications.integration.test.ts'
  './src/lib/vendor-marketplace-communications.integration.test.ts'
  './src/lib/wedding-communication-roles.test.ts'
)
find . -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) \
  -not -path './node_modules/*' \
  -not -path './.next/*' \
  -not -path './tests/e2e/*' \
  | sort > /tmp/wewed-bun-tests-all.txt
cp /tmp/wewed-bun-tests-all.txt /tmp/wewed-bun-tests.txt
for broken in "${BASELINE_BROKEN[@]}"; do
  if ! grep -Fxq "$broken" /tmp/wewed-bun-tests-all.txt; then
    echo "Documented baseline test is missing: $broken" >&2
    exit 1
  fi
  grep -Fxv "$broken" /tmp/wewed-bun-tests.txt > /tmp/wewed-bun-tests-next.txt
  mv /tmp/wewed-bun-tests-next.txt /tmp/wewed-bun-tests.txt
done
readarray -t BUN_TEST_FILES < /tmp/wewed-bun-tests.txt
printf 'Bun regression files after documented baseline exclusions: %s\n' "${#BUN_TEST_FILES[@]}"
if [[ ${#BUN_TEST_FILES[@]} -eq 0 ]]; then
  echo 'No Bun regression tests discovered.' >&2
  exit 1
fi
bun test "${BUN_TEST_FILES[@]}"

printf '\n== Build production application ==\n'
bun run build

printf '\n== Install Chromium runtime ==\n'
yum install -y \
  alsa-lib atk at-spi2-atk cups-libs libdrm libX11 libXcomposite libXdamage libXext \
  libXfixes libXrandr mesa-libgbm nss pango gtk3 liberation-fonts || true
bunx playwright install chromium

printf '\n== Run Contributions browser qualification ==\n'
bunx playwright test tests/e2e/planner-contributions.spec.ts

printf '\n== Final diff hygiene ==\n'
git diff --check

echo 'DISPOSABLE CONTRIBUTIONS CI REPLICA PASSED'
