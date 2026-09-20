#!/usr/bin/env python3
"""Build the canonical Private Real UAT snapshot (schema `private-real-uat/2`).

WHY THIS EXISTS
    Two "real" snapshots had drifted apart: the extractor wrote
    `charity-kudzie-private-real-uat.json` in a `{wedding, domains:{Guest,…}}` shape, while the
    native apps still read `charity-kudzie-private-real-shadow.json` in a flat
    `{wedding, tasks, guests, …}` shape. Neither platform saw the expanded graph. This builder
    collapses that into ONE versioned schema that Android and iOS both parse.

WHAT IT DOES
    raw authorized extract
      -> project every domain through the shared UAT field allowlist (drops tokens/forensics)
      -> normalise to the canonical camelCase domain names the native loaders expect
      -> attach couple / planner / admin context blocks
      -> stamp metadata (schema version, content hash, domain counts)
      -> write protected snapshot + manifest, mode 600, outside the repository

The allowlist is imported from `uat_field_allowlist.py`, the same module the production extractor
uses, so a snapshot built here and one extracted directly from production carry identical columns.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from uat_field_allowlist import (  # noqa: E402
    DENIED_FIELDS, assert_allowlist_is_safe, audit_rows, project,
)

PROTECTED_DIR = Path.home() / ".wewed-shadow" / "charity-kudzie"
UAT_SCHEMA_VERSION = "private-real-uat/2"

# Production table -> canonical domain key used by both native loaders.
DOMAIN_KEYS = {
    "Guest": "guests",
    "RSVP": "rsvps",
    "PlannerTask": "tasks",
    "BudgetItem": "budgetItems",
    "GuestContribution": "contributions",
    "SeatingTable": "seatingTables",
    "ProgrammeItem": "programme",
    "Vendor": "vendors",
    "ServiceEngagement": "serviceEngagements",
    "EngagementParty": "engagementParties",
    "Song": "songs",
    "WeddingContent": "weddingContent",
    "ContentRevision": "contentRevisions",
    "Message": "messages",
    "QRDestination": "qrDestinations",
    "ImportJob": "importJobs",
    "AuditEvent": "auditEvents",
    "MediaItem": "mediaItems",
    "Contract": "contracts",
    "ContractVersion": "contractVersions",
    "Comment": "comments",
    "Notification": "notifications",
    "VaultObject": "vaultObjects",
    "VaultLink": "vaultLinks",
    "Reminder": "reminders",
    "PlannerEnquiry": "plannerEnquiries",
    "PlannerEngagement": "plannerEngagements",
    "WeddingMembership": "weddingMemberships",
}


def content_hash(payload: dict) -> str:
    """Stable hash over everything except the hash field itself."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def build(raw: dict) -> dict:
    wedding = project("Wedding", [raw["wedding"]])[0]
    raw_domains = raw.get("domains", {})

    domains: dict[str, list] = {}
    for table, key in DOMAIN_KEYS.items():
        domains[key] = project(table, raw_domains.get(table, []) or [])

    planner_profiles = project("PlannerProfile", raw.get("plannerProfiles", []) or [])

    # Couple context: the authoritative UAT couple actor, derived from the wedding itself.
    couple_context = {
        "weddingId": wedding["id"],
        "displayName": wedding.get("title"),
        "slug": wedding.get("slug"),
        "coupleId": wedding.get("coupleId"),
        "provenance": "PRODUCTION_DERIVED",
    }

    # Planner context. Production holds PlannerEngagement = 0 and WeddingMembership = 0 for this
    # wedding, so the planner's access to Charity & Kudzie is a UAT overlay, not a production
    # membership. That distinction is carried in the data so the UI can state it honestly instead
    # of implying a contractual engagement that does not exist.
    enquiries = domains["plannerEnquiries"]
    planner_context = {
        "profile": planner_profiles[0] if planner_profiles else None,
        "enquiry": enquiries[0] if enquiries else None,
        "productionEngagementCount": len(domains["plannerEngagements"]),
        "productionMembershipCount": len(domains["weddingMemberships"]),
        "accessBasis": (
            "PRODUCTION_ENGAGEMENT" if domains["plannerEngagements"] else "UAT_OVERLAY"
        ),
        "provenance": "PRODUCTION_DERIVED" if planner_profiles else "ABSENT",
    }

    # Admin context stays explicitly blocked rather than empty: the reader role is denied
    # SupportCase / BusinessAuditLog / BusinessAccount, which is an authorization boundary and not
    # an absence of data.
    admin_context = {
        "status": "BLOCKED_BY_AUTHORIZATION",
        "deniedDomains": ["SupportCase", "BusinessAuditLog", "PlannerShortlist", "ProviderEnquiry"],
        "emptyDomains": ["BusinessAccount"],
        "note": "Requires an explicitly authorized read-only grant covering the Admin UAT domains.",
        "provenance": "ABSENT",
    }

    counts = {k: len(v) for k, v in domains.items()}
    body = {
        "wedding": wedding,
        "coupleContext": couple_context,
        "plannerContext": planner_context,
        "adminContext": admin_context,
        "domains": domains,
    }

    snapshot = {
        "metadata": {
            "schemaVersion": UAT_SCHEMA_VERSION,
            "mode": "PRIVATE_REAL_UAT",
            "sourceWeddingId": wedding["id"],
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "extractGeneratedAt": raw.get("generatedAt"),
            "provenance": raw.get("provenance", {}),
            "contentHash": content_hash(body),
            "domainCounts": counts,
        },
        **body,
    }
    return snapshot


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", default=str(PROTECTED_DIR / "charity-kudzie-private-real-uat.json"))
    parser.add_argument("--out", default=str(PROTECTED_DIR / "charity-kudzie-private-real-uat-v2.json"))
    args = parser.parse_args()

    assert_allowlist_is_safe()

    out_path = Path(args.out).expanduser()
    repo_root = Path(__file__).resolve().parents[3]
    if repo_root in out_path.resolve().parents:
        print(f"FAIL: refusing to write UAT data inside the repository ({out_path}).")
        return 2

    raw = json.loads(Path(args.raw).expanduser().read_text())
    snapshot = build(raw)

    # Prove the allowlist held: no denied or unlisted column may survive anywhere.
    reverse = {v: k for k, v in DOMAIN_KEYS.items()}
    violations: list[str] = []
    for key, rows in snapshot["domains"].items():
        if rows:
            violations.extend(audit_rows(reverse[key], rows))
    violations.extend(audit_rows("Wedding", [snapshot["wedding"]]))
    if snapshot["plannerContext"]["profile"]:
        violations.extend(audit_rows("PlannerProfile", [snapshot["plannerContext"]["profile"]]))
    if snapshot["plannerContext"]["enquiry"]:
        violations.extend(audit_rows("PlannerEnquiry", [snapshot["plannerContext"]["enquiry"]]))
    if violations:
        print("FAIL: non-allowlisted column reached the canonical snapshot; refusing to write.")
        for v in sorted(set(violations)):
            print(f"   {v}")
        return 5

    # Belt and braces, per domain: a denied column in one table can be legitimately allowed in
    # another (PlannerProfile.reviewNotes is control data; GuestContribution.reviewedAt is not),
    # so the check is scoped to the table it was denied for rather than to the whole blob.
    def _blob(rows) -> str:
        return json.dumps(rows, default=str)

    scoped = {reverse[k]: v for k, v in snapshot["domains"].items()}
    scoped["Wedding"] = [snapshot["wedding"]]
    if snapshot["plannerContext"]["profile"]:
        scoped["PlannerProfile"] = [snapshot["plannerContext"]["profile"]]
    if snapshot["plannerContext"]["enquiry"]:
        scoped.setdefault("PlannerEnquiry", []).append(snapshot["plannerContext"]["enquiry"])

    leaked = sorted({
        f"{table}.{field}"
        for table, fields in DENIED_FIELDS.items()
        for field in fields
        if scoped.get(table) and f'"{field}":' in _blob(scoped[table])
    })
    if leaked:
        print("FAIL: denied field names present in canonical snapshot:", ", ".join(leaked))
        return 6

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(snapshot, indent=2, default=str))
    out_path.chmod(0o600)
    digest = hashlib.sha256(out_path.read_bytes()).hexdigest()

    manifest = {
        "target": "PRIVATE_REAL_UAT",
        "schemaVersion": UAT_SCHEMA_VERSION,
        "file": out_path.name,
        "generatedAt": snapshot["metadata"]["generatedAt"],
        "sourceWeddingId": snapshot["metadata"]["sourceWeddingId"],
        "sha256": digest,
        "contentHash": snapshot["metadata"]["contentHash"],
        "domainCounts": snapshot["metadata"]["domainCounts"],
    }
    manifest_path = out_path.with_name("private-real-uat-v2-manifest.json")
    manifest_path.write_text(json.dumps(manifest, indent=2))
    manifest_path.chmod(0o600)

    print(f"wrote {out_path.name} ({out_path.stat().st_size} bytes)")
    print(f"schema={UAT_SCHEMA_VERSION} sha256={digest[:16]}… contentHash={snapshot['metadata']['contentHash'][:16]}…")
    print("domain counts (non-zero):")
    for key, n in sorted(snapshot["metadata"]["domainCounts"].items(), key=lambda kv: -kv[1]):
        if n:
            print(f"   {key:<22} {n}")
    print(f"planner accessBasis = {snapshot['plannerContext']['accessBasis']}")
    print(f"admin status        = {snapshot['adminContext']['status']}")
    print("token/credential columns exported: 0 (allowlist enforced, denied-name scan clean)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
