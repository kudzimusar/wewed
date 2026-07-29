#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export DATABASE_URL="${WEWED_STAGING_DATABASE_URL:-${DATABASE_URL:-}}"
backup="${1:-}"
[[ -n "$backup" && -f "$backup" ]] || { echo "Usage: $0 <staging-backup.dump>" >&2; exit 1; }
"$ROOT_DIR/scripts/assert-staging-db.sh"
pg_restore --dbname="$DATABASE_URL" --clean --if-exists --no-owner --no-acl --schema=staging "$backup"
"$ROOT_DIR/scripts/assert-staging-db.sh"
echo "Restored Wewed staging from: $backup"
