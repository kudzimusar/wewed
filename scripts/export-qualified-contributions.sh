#!/usr/bin/env bash
set -euo pipefail

# This script exports only the generated working-tree delta after v11 materialization.
EXPORT_ROOT='/tmp/contributions-qualified-export'
FILES_LIST="$EXPORT_ROOT/files.txt"
DELETIONS_LIST="$EXPORT_ROOT/deletions.txt"
ARCHIVE='public/contributions-qualified-files.tar.gz'
MANIFEST='public/contributions-qualified-manifest.txt'

rm -rf "$EXPORT_ROOT"
mkdir -p "$EXPORT_ROOT"
rm -f "$ARCHIVE" "$MANIFEST"

{
  git diff --name-only --diff-filter=ACMRTUXB
  git ls-files --others --exclude-standard
} | grep -v '^public/contributions-qualified-' | sort -u > "$FILES_LIST"

git diff --name-only --diff-filter=D | sort -u > "$DELETIONS_LIST"

if [[ ! -s "$FILES_LIST" ]]; then
  echo 'No generated Contributions files found to export.' >&2
  exit 1
fi

{
  echo '# Qualified Contributions generated-product export'
  echo '# Files'
  cat "$FILES_LIST"
  echo '# Deletions'
  cat "$DELETIONS_LIST"
} > "$MANIFEST"

tar -czf "$ARCHIVE" -T "$FILES_LIST"

echo "Exported $(wc -l < "$FILES_LIST") generated files."
echo "Archive: $ARCHIVE"
echo "Manifest: $MANIFEST"
