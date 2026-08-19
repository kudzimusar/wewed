#!/usr/bin/env bash
set -euo pipefail

FILES='/tmp/contributions-generated-files.txt'
{
  git diff --name-only --diff-filter=ACMRTUXB
  git ls-files --others --exclude-standard
} | grep -v '^public/contributions-qualified-' \
  | grep -v '^scripts/export-qualified-contributions.sh$' \
  | grep -v '^scripts/push-qualified-contributions.sh$' \
  | grep -v '^scripts/print-qualified-contributions.sh$' \
  | sort -u > "$FILES"

index=0
while IFS= read -r path; do
  index=$((index + 1))
  bytes="$(wc -c < "$path" | tr -d ' ')"
  sha="$(sha256sum "$path" | awk '{print $1}')"
  printf '%02d\t%s\t%s\t%s\n' "$index" "$bytes" "$sha" "$path"
done < "$FILES"
