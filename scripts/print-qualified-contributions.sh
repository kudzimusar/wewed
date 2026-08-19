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
  | grep -v '^vercel.json$' \
  | sort -u > "$FILES"

START="${EXPORT_START:-1}"
END="${EXPORT_END:-999}"
TOTAL="$(wc -l < "$FILES" | tr -d ' ')"
echo "QUALIFIED_BLOB_EXPORT total=$TOTAL start=$START end=$END"

index=0
while IFS= read -r path; do
  index=$((index + 1))
  if (( index < START || index > END )); then
    continue
  fi
  bytes="$(wc -c < "$path" | tr -d ' ')"
  sha="$(sha256sum "$path" | awk '{print $1}')"
  echo "BEGIN_BLOB index=$index bytes=$bytes sha256=$sha path=$path"
  base64 -w512 "$path"
  echo "END_BLOB index=$index path=$path"
done < "$FILES"

echo "QUALIFIED_BLOB_EXPORT_DONE"
