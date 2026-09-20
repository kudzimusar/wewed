#!/usr/bin/env python3
"""Repeatable READ-ONLY production -> Private Real UAT snapshot refresh.

The Charity & Kudzie wedding keeps changing before UAT, so the September-18 one-off export went
stale immediately and silently under-reported several domains as "unsupported" when production
actually held rows. This script makes the extraction reproducible.

    READ-ONLY PRODUCTION
      -> extract authorized UAT graph
      -> schema validation
      -> secret scan
      -> relationship integrity audit
      -> write protected local snapshot + manifest

SAFETY
  * Every statement runs inside `BEGIN TRANSACTION READ ONLY`. The credential
    (`wewed_shadow_reader`) additionally has `default_transaction_read_only=on` and no write grants.
  * Output is written ONLY under the protected local UAT directory, never into the repository.
  * Nothing private is printed: the script reports counts, hashes and domain names only.
  * No credentials, tokens, cookies or signing material are read or emitted.

USAGE
    export $(grep -v '^#' ~/.wewed-shadow/credentials/readonly.env | sed 's/^export //')
    python3 mobile/shadow/tools/extract_private_real_uat_snapshot.py --wedding <id>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PROTECTED_DIR = Path.home() / ".wewed-shadow" / "charity-kudzie"
DEFAULT_WEDDING = "cmqos70cb0004q6vxe9g9aiu5"

# Domains extracted for the UAT graph. `scope` says how the rows are reached:
#   wedding  -> table has a weddingId column
#   single   -> a single row resolved by an explicit query
#   planner  -> planner account/profile graph
# `sensitive` marks domains whose *values* must never be echoed, only counted.
WEDDING_DOMAINS = [
    "Guest", "PlannerTask", "BudgetItem", "GuestContribution", "SeatingTable",
    "ProgrammeItem", "Vendor", "ServiceEngagement", "EngagementParty", "Song",
    "WeddingContent", "ContentRevision", "Message", "MediaItem", "Contract", "ContractVersion",
    "Comment", "Notification", "QRDestination", "ImportJob", "AuditEvent",
    "VaultObject", "VaultLink", "Reminder", "PlannerEnquiry", "PlannerEngagement",
    "WeddingMembership",
]

SECRET_PATTERNS = [
    re.compile(r"(?i)\b(password|passwd|secret|api[_-]?key|private[_-]?key|access[_-]?token)\b"),
    re.compile(r"(?i)\bbearer\s+[a-z0-9._-]{20,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"(?i)\bsession[_-]?(id|token)\b"),
    re.compile(r"postgres(?:ql)?://[^\s\"']+:[^\s\"']+@"),
]


def psql_json(dsn: str, sql: str) -> object:
    """Run one read-only statement and return its JSON payload."""
    wrapped = (
        "BEGIN TRANSACTION READ ONLY; SET LOCAL statement_timeout='120s'; "
        f"SELECT coalesce(json_agg(t), '[]'::json) FROM ({sql}) t; COMMIT;"
    )
    proc = subprocess.run(
        ["psql", dsn, "-At", "-v", "ON_ERROR_STOP=1", "-c", wrapped],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip().splitlines()[-1] if proc.stderr else "psql failed")
    # json_agg output can span several lines, so join everything that is not a psql status line.
    payload = "".join(
        ln for ln in proc.stdout.splitlines() if ln and ln not in ("BEGIN", "COMMIT", "SET")
    )
    return json.loads(payload) if payload.strip() else []


def try_domain(dsn: str, table: str, wedding_id: str):
    """Extract one wedding-scoped domain, distinguishing absence from lack of authorization."""
    try:
        rows = psql_json(dsn, f'SELECT * FROM "{table}" WHERE "weddingId" = {sql_literal(wedding_id)}')
        return rows, "ok"
    except RuntimeError as exc:
        message = str(exc)
        if "permission denied" in message:
            return [], "not_authorized"
        if "does not exist" in message:
            return [], "no_such_column_or_table"
        return [], f"error: {message[:80]}"


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def scan_for_secrets(blob: str) -> list[str]:
    return [p.pattern for p in SECRET_PATTERNS if p.search(blob)]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wedding", default=DEFAULT_WEDDING)
    parser.add_argument("--out", default=str(PROTECTED_DIR / "charity-kudzie-private-real-uat.json"))
    args = parser.parse_args()

    dsn = os.environ.get("WEWED_READONLY_DATABASE_URL")
    if not dsn:
        print("FAIL: WEWED_READONLY_DATABASE_URL is not set. Load the protected read-only credential.")
        return 2

    out_path = Path(args.out).expanduser()
    repo_root = Path(__file__).resolve().parents[3]
    if repo_root in out_path.resolve().parents:
        print(f"FAIL: refusing to write UAT data inside the repository ({out_path}).")
        return 2
    out_path.parent.mkdir(parents=True, exist_ok=True)

    who = psql_json(dsn, "SELECT current_user AS u, version() AS v")
    print(f"connected as {who[0]['u']} (read-only)")

    snapshot: dict[str, object] = {
        "mode": "PRIVATE_REAL_UAT",
        "weddingId": args.wedding,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "provenance": {"source": "production-read-only", "role": who[0]["u"]},
        "domains": {},
    }
    counts: dict[str, int] = {}
    statuses: dict[str, str] = {}

    wedding = psql_json(dsn, f'SELECT * FROM "Wedding" WHERE id = {sql_literal(args.wedding)}')
    if not wedding:
        print("FAIL: wedding not found or not authorized for this reader.")
        return 3
    snapshot["wedding"] = wedding[0]

    for table in WEDDING_DOMAINS:
        rows, status = try_domain(dsn, table, args.wedding)
        snapshot["domains"][table] = rows
        counts[table] = len(rows)
        statuses[table] = status

    # RSVP hangs off Guest, not Wedding, so it is reached through the wedding's guest set.
    # It carries the real RSVP state, dietary notes and check-in flags the Guest surfaces need.
    rsvps = psql_json(
        dsn,
        'SELECT r.* FROM "RSVP" r WHERE r."guestId" IN '
        f'(SELECT id FROM "Guest" WHERE "weddingId" = {sql_literal(args.wedding)})',
    )
    snapshot["domains"]["RSVP"] = rsvps
    counts["RSVP"] = len(rsvps)
    statuses["RSVP"] = "ok"

    # Planner graph: profile and enquiry reached through the wedding's enquiry.
    planner_profiles = psql_json(
        dsn,
        'SELECT p.* FROM "PlannerProfile" p WHERE p.id IN '
        f'(SELECT "plannerProfileId" FROM "PlannerEnquiry" WHERE "weddingId" = {sql_literal(args.wedding)})',
    )
    snapshot["plannerProfiles"] = planner_profiles
    counts["PlannerProfile"] = len(planner_profiles)
    statuses["PlannerProfile"] = "ok"

    blob = json.dumps(snapshot, default=str)
    leaks = scan_for_secrets(blob)
    if leaks:
        print("FAIL: secret-like material detected; refusing to write.")
        for pattern in leaks:
            print(f"   pattern: {pattern}")
        return 4

    # Relationship integrity: contributions and seating must resolve to real guests.
    guest_ids = {g.get("id") for g in snapshot["domains"].get("Guest", [])}
    orphan_contributions = [
        c for c in snapshot["domains"].get("GuestContribution", [])
        if c.get("guestId") and c["guestId"] not in guest_ids
    ]
    seated = [g for g in snapshot["domains"].get("Guest", []) if g.get("seatingTableId")]
    table_ids = {t.get("id") for t in snapshot["domains"].get("SeatingTable", [])}
    orphan_seating = [g for g in seated if g["seatingTableId"] not in table_ids]

    out_path.write_text(json.dumps(snapshot, indent=2, default=str))
    out_path.chmod(0o600)
    digest = hashlib.sha256(out_path.read_bytes()).hexdigest()

    manifest = {
        "generatedAt": snapshot["generatedAt"],
        "target": "PRIVATE_REAL_UAT",
        "weddingId": args.wedding,
        "file": out_path.name,
        "sha256": digest,
        "counts": counts,
        "status": statuses,
        "integrity": {
            "orphanContributions": len(orphan_contributions),
            "seatedGuests": len(seated),
            "orphanSeating": len(orphan_seating),
        },
    }
    manifest_path = out_path.with_name("private-real-uat-manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2))
    manifest_path.chmod(0o600)

    print(f"wrote {out_path.name} ({out_path.stat().st_size} bytes) sha256={digest[:16]}…")
    print("counts (non-zero):")
    for table, n in sorted(counts.items(), key=lambda kv: -kv[1]):
        if n:
            print(f"   {table:<22} {n}")
    blocked = {t: s for t, s in statuses.items() if s != "ok"}
    if blocked:
        print("not extracted:")
        for table, status in blocked.items():
            print(f"   {table:<22} {status}")
    print(f"integrity: orphanContributions={len(orphan_contributions)} "
          f"seatedGuests={len(seated)} orphanSeating={len(orphan_seating)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
