#!/usr/bin/env bash
set -euo pipefail

EXPECTED_REF="kjigkhjdeymukwradoqu"
REF_FILE="supabase/.temp/project-ref"

if [ ! -f "$REF_FILE" ]; then
  echo "ERROR: This repository is not linked to a Supabase project."
  echo "Run: supabase link --project-ref $EXPECTED_REF"
  exit 1
fi

ACTUAL_REF="$(tr -d '[:space:]' < "$REF_FILE")"

if [ "$ACTUAL_REF" != "$EXPECTED_REF" ]; then
  echo "ERROR: Wrong Supabase project linked."
  echo "Expected: $EXPECTED_REF"
  echo "Actual:   $ACTUAL_REF"
  exit 1
fi

echo "Supabase project verified: Wewed ($ACTUAL_REF)"
