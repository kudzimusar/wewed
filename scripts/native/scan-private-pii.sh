#!/usr/bin/env bash
# LOCAL-ONLY leak check: are any real guest names from the private snapshot present in Git?
# Prints counts only. Never prints a name.
#
# Scans (a) every tracked file at HEAD, (b) every line added by commits on this branch since
# the base ref, and (c) untracked, non-ignored files. Multi-word names are matched everywhere;
# single-word names are too common to match repository-wide, so they are checked only against
# lines this branch added (whole-word) and reported as "needs review" if found.
#
# Usage: scripts/native/scan-private-pii.sh [base-ref]   (default: origin/main)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASE="${1:-origin/main}"
SNAPSHOT="${WEWED_PRIVATE_SHADOW_PATH:-$HOME/.wewed-shadow/charity-kudzie/charity-kudzie-private-real-shadow.json}"
[ -f "$SNAPSHOT" ] || { echo "SKIP: private snapshot not present on this machine."; exit 0; }

cd "$ROOT"
python3 - "$SNAPSHOT" "$BASE" <<'PY'
import json, re, subprocess, sys
snapshot, base = sys.argv[1:3]
names = sorted({g["name"].strip() for g in json.load(open(snapshot))["guests"] if g.get("name", "").strip()})
multi = [n for n in names if len(n.split()) > 1]
single = [n for n in names if len(n.split()) == 1]

def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, errors="replace").stdout

tracked = [p for p in git("ls-files", "-z").split("\0") if p]
untracked = [p for p in git("ls-files", "-z", "--others", "--exclude-standard").split("\0") if p]
merge_base = git("merge-base", "HEAD", base).strip()
added = "\n".join(l[1:] for l in git("log", "-p", "--no-color", f"{merge_base}..HEAD").splitlines()
                  if l.startswith("+") and not l.startswith("+++"))

def read(path):
    try:
        with open(path, "rb") as fh:
            data = fh.read()
        return "" if b"\0" in data[:4096] else data.decode("utf-8", "replace")
    except OSError:
        return ""

def hits(text, candidates, whole_word=False):
    found = set()
    for n in candidates:
        if (re.search(r"(?<![\w])" + re.escape(n) + r"(?![\w])", text) if whole_word else n in text):
            found.add(n)
    return found

tracked_hits, tracked_files, locations, introduced = set(), 0, [], set()
for path in tracked:
    h = hits(read(path), multi)
    if h:
        tracked_hits |= h; tracked_files += 1
        base_h = hits(git("show", f"{base}:{path}"), h)
        on_base = base_h == h
        introduced |= (h - base_h)
        locations.append(f"  {path} ({len(h)} name(s); {'already on ' + base if on_base else 'introduced on this branch'})")
untracked_hits = set()
for path in untracked:
    untracked_hits |= hits(read(path), multi)
history_hits = hits(added, multi)
commit_locations = []
for commit in git("rev-list", f"{merge_base}..HEAD").split():
    body = "\n".join(l[1:] for l in git("show", "--no-color", "--format=", commit).splitlines()
                     if l.startswith("+") and not l.startswith("+++"))
    h = hits(body, multi)
    if h:
        commit_locations.append(f"  commit {commit[:8]} added {len(h)} name(s)")
single_review = hits(added, single, whole_word=True)

print(f"names checked: {len(multi)} multi-word everywhere, {len(single)} single-word on branch additions")
print(f"branch commits scanned: {git('rev-list', '--count', f'{merge_base}..HEAD').strip()} (since merge-base with {base})")
print(f"tracked files at HEAD: {len(tracked)} scanned; real guest names found = {len(tracked_hits)} (in {tracked_files} files)")
print("\n".join(locations))
print(f"lines added on this branch: real guest names found = {len(history_hits)}")
print("\n".join(commit_locations))
print(f"untracked non-ignored files: {len(untracked)} scanned; real guest names found = {len(untracked_hits)}")
print(f"single-word names on branch additions (needs review if > 0) = {len(single_review)}")
ok = not (introduced or history_hits or untracked_hits)
if ok and tracked_hits:
    print(f"WARNING: {len(tracked_hits)} name(s) already present on {base} (listed above); not introduced by the scanned commits")
print("RESULT:", "PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
PY
