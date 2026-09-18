#!/usr/bin/env bash
set -euo pipefail

EXPECTED_BRANCH="native-mobile/shadow-setup-implementation-20260918"
BASE_REF="origin/native-mobile/shadow-real-wedding-plan-20260918"
REMOTE_REF="origin/${EXPECTED_BRANCH}"

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "== Wewed Native Shadow local preflight =="
echo "root: $ROOT"

git fetch origin --prune

branch="$(git branch --show-current)"
local_head="$(git rev-parse HEAD)"
remote_head="$(git rev-parse "$REMOTE_REF")"
divergence="$(git rev-list --left-right --count HEAD..."$REMOTE_REF")"

echo "branch: $branch"
echo "local HEAD: $local_head"
echo "remote HEAD: $remote_head"
echo "divergence: $divergence"

if [[ "$branch" != "$EXPECTED_BRANCH" ]]; then
  echo "FAIL: expected branch $EXPECTED_BRANCH"
  exit 2
fi

if [[ "$local_head" != "$remote_head" ]]; then
  echo "FAIL: local and remote HEAD do not match"
  exit 3
fi

if [[ "$divergence" != $'0\t0' && "$divergence" != "0 0" ]]; then
  echo "FAIL: local/remote divergence is not zero"
  exit 4
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "FAIL: worktree is not clean"
  git status --short
  exit 5
fi

echo "Checking changed-path isolation..."
outside_scope="$(
  git diff --name-only "$BASE_REF"...HEAD |
  grep -Ev '^(apps/ios/|apps/android/|mobile/|docs/native-mobile/|\.maestro/|\.gitignore)' || true
)"

if [[ -n "$outside_scope" ]]; then
  echo "FAIL: changes outside authorized native scope:"
  echo "$outside_scope"
  exit 6
fi

echo "PASS: repository alignment and isolation"

echo
echo "== iOS Swift tests =="
(
  cd apps/ios
  swift test
)

echo
echo "== iOS Swift build =="
(
  cd apps/ios
  swift build
)

echo
echo "== Android unit tests =="
(
  cd apps/android
  ./gradlew testDebugUnitTest
)

echo
echo "== Android debug assembly =="
(
  cd apps/android
  ./gradlew assembleDebug
)

echo
echo "PASS: non-simulator native qualification complete"
echo "Exact tested HEAD: $(git rev-parse HEAD)"
echo "Simulator/Maestro qualification may proceed only after this script passes."
