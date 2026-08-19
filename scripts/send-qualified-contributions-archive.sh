#!/usr/bin/env bash
set -euo pipefail

python3 scripts/contributions-alignment-driver-v11.py >/tmp/contributions-driver.log 2>&1 || {
  cat /tmp/contributions-driver.log
  exit 1
}

{
  git diff --name-only --diff-filter=ACMRTUXB
  git ls-files --others --exclude-standard
} | grep -v '^public/contributions-qualified-' \
  | grep -v '^scripts/' \
  | grep -v '^vercel.json$' \
  | sort -u > /tmp/contributions-mail-files.txt

count="$(wc -l < /tmp/contributions-mail-files.txt | tr -d ' ')"
if [[ "$count" != "39" ]]; then
  echo "Expected 39 qualified product files, found $count" >&2
  cat /tmp/contributions-mail-files.txt >&2
  exit 1
fi

tar -czf /tmp/contributions-qualified-product.tar.gz -T /tmp/contributions-mail-files.txt
echo "TRANSFER_FILES=$count"
sha256sum /tmp/contributions-qualified-product.tar.gz
node scripts/email-qualified-contributions.js
