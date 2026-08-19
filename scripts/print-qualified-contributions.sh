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

BATCH="${EXPORT_BATCH:-1}"
BATCH_SIZE="${EXPORT_BATCH_SIZE:-10}"
START=$(( (BATCH - 1) * BATCH_SIZE + 1 ))
END=$(( BATCH * BATCH_SIZE ))
TOTAL="$(wc -l < "$FILES" | tr -d ' ')"

echo "QUALIFIED_EXPORT total=$TOTAL batch=$BATCH start=$START end=$END"
nl -ba "$FILES" | sed -n "${START},${END}p"

index=0
while IFS= read -r path; do
  index=$((index + 1))
  if (( index < START || index > END )); then
    continue
  fi
  bytes="$(wc -c < "$path" | tr -d ' ')"
  sha="$(sha256sum "$path" | awk '{print $1}')"
  echo "BEGIN_QUALIFIED_FILE index=$index path=$path bytes=$bytes sha256=$sha"
  base64 -w0 "$path"
  echo
  echo "END_QUALIFIED_FILE index=$index path=$path"
done < "$FILES"

echo "QUALIFIED_EXPORT_DONE batch=$BATCH"
