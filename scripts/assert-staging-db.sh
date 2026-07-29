#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${WEWED_STAGING_DATABASE_URL:-${DATABASE_URL:-}}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "ERROR: WEWED_STAGING_DATABASE_URL (or DATABASE_URL) is required." >&2
  exit 1
fi

if [[ "$DATABASE_URL" != *"schema=staging"* ]]; then
  echo "ERROR: refusing operation because the URL does not target schema=staging." >&2
  exit 1
fi

if [[ "$DATABASE_URL" == *"schema=public"* ]]; then
  echo "ERROR: refusing operation against production schema=public." >&2
  exit 1
fi

marker="$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "select environment || ':' || reset_allowed::text from staging._wewed_environment where id = 1")"
if [[ "$marker" != "staging:true" ]]; then
  echo "ERROR: staging safety marker missing or reset is disabled (received '$marker')." >&2
  exit 1
fi

echo "Verified isolated Wewed staging schema."
