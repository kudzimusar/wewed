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

if [[ ! -s "$FILES" ]]; then
  echo 'No generated product files to publish.' >&2
  exit 1
fi

git config user.name 'Wewed Contributions Qualification'
git config user.email 'actions@users.noreply.github.com'
while IFS= read -r path; do
  git add -- "$path"
done < "$FILES"
git diff --cached --check
git commit -m 'Materialize qualified Contributions product (isolated export)'

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin https://github.com/kudzimusar/wewed.git
fi
printf 'origin=%s\n' "$(git remote get-url origin)"
git push --force origin HEAD:refs/heads/ci/contributions-generated-materialized

echo 'QUALIFIED GENERATED TREE PUSHED'
