#!/usr/bin/env bash
set -euo pipefail

EXPECTED_BRANCH="${WEWED_NATIVE_EXPECTED_BRANCH:-native-mobile/wedding-identity-ui-20260918}"
BASE_REF="${WEWED_NATIVE_BASE_REF:-origin/native-mobile/shadow-real-wedding-plan-20260918}"
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
  grep -Ev '^(apps/ios/|apps/android/|mobile/|docs/native-mobile/|\.maestro/|\.github/workflows/native-|\.github/scripts/verify-android-local-package\.sh|\.gitignore)' || true
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
echo "== iOS application target =="
if ! command -v xcodegen >/dev/null 2>&1; then
  echo "FAIL: xcodegen is required. Install it with: brew install xcodegen"
  exit 7
fi
(
  cd apps/ios
  xcodegen generate --spec project.yml
  xcodebuild     -project Wewed.xcodeproj     -scheme Wewed     -configuration Debug     -sdk iphonesimulator     -destination 'generic/platform=iOS Simulator'     CODE_SIGNING_ALLOWED=NO     build
)

echo
echo "== Android unit tests =="
(
  cd apps/android
  ./gradlew testDebugUnitTest
)

echo
echo "== Android debug + release assembly =="
(
  cd apps/android
  ./gradlew assembleDebug assembleRelease
)

echo
echo "== Android local package isolation =="
bash .github/scripts/verify-android-local-package.sh apps/android/app/build/outputs/apk/debug pro.wewed.app.dev

release_metadata="apps/android/app/build/outputs/apk/release/output-metadata.json"
test -f "$release_metadata" || {
  echo "FAIL: Android release metadata missing"
  exit 8
}
release_package="$(sed -n 's/.*"applicationId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$release_metadata" | head -n 1)"
test "$release_package" = "pro.wewed.app" || {
  echo "FAIL: Android release package is '$release_package'; expected pro.wewed.app"
  exit 9
}
echo "PASS: Android release package remains pro.wewed.app"

echo
echo "PASS: non-simulator native qualification complete"
echo "Exact tested HEAD: $(git rev-parse HEAD)"
echo "Simulator/Maestro qualification may proceed only after this script passes."
