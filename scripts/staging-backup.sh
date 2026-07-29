#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DATABASE_URL="${WEWED_STAGING_DATABASE_URL:-${DATABASE_URL:-}}"
"$ROOT_DIR/scripts/assert-staging-db.sh"
mkdir -p "$ROOT_DIR/backups"
output="${1:-$ROOT_DIR/backups/wewed-staging-$(date -u +%Y%m%dT%H%M%SZ).dump}"
pg_dump "$DATABASE_URL" --format=custom --schema=staging --no-owner --no-acl --file="$output"
echo "Created staging backup: $output"
