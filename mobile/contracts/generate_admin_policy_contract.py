#!/usr/bin/env python3
"""Generate the native Admin policy contract from the web Admin policy module.

The Wewed Admin role model, its permissions and the account lifecycle already exist, once, in
`src/lib/wewed-admin-policy.ts`. That module is framework-agnostic: it is the shared policy layer
the web Admin API enforces.

Re-typing it into Kotlin and Swift by hand would create three copies that drift, and a native app
that believes a Support Admin may suspend an account when the server disagrees is worse than a
native app that cannot suspend at all. So the contract is DERIVED from the web module and both
platforms assert equality against it, exactly as they do for the IA V2 navigation contract.

Run after changing the policy module; the generated JSON is committed and asserted in unit tests
on both platforms, so a drift shows up as a failing test rather than as a wrong button.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / "src" / "lib" / "wewed-admin-policy.ts"
OUTPUT = REPO / "mobile" / "contracts" / "admin-policy.json"
CONTRACT_VERSION = "wewed-admin-policy/1"


def string_array(name: str, text: str) -> list[str]:
    match = re.search(rf"export const {name} = \[(.*?)\] as const", text, re.S)
    if not match:
        raise SystemExit(f"FAIL: could not read {name} from the policy module")
    return re.findall(r"'([^']+)'", match.group(1))


def role_permissions(text: str, permissions: list[str]) -> dict[str, list[str]]:
    block = re.search(r"const ROLE_PERMISSIONS: Record<.*?> = \{(.*?)\n\}", text, re.S)
    if not block:
        raise SystemExit("FAIL: could not read ROLE_PERMISSIONS from the policy module")
    resolved: dict[str, list[str]] = {}
    for role, body in re.findall(r"(\w+): \[(.*?)\],?\n", block.group(1) + "\n", re.S):
        granted = re.findall(r"'([^']+)'", body)
        # '*' is Super Admin: every permission, expanded here so no consumer has to know the wildcard.
        resolved[role] = list(permissions) if granted == ["*"] else granted
    return resolved


def transitions(text: str) -> dict[str, list[str]]:
    block = re.search(r"const ACCOUNT_TRANSITIONS: Record<.*?> = \{(.*?)\n\}", text, re.S)
    if not block:
        raise SystemExit("FAIL: could not read ACCOUNT_TRANSITIONS from the policy module")
    return {
        status: re.findall(r"'([^']+)'", body)
        for status, body in re.findall(r"(\w+): \[(.*?)\],?\n", block.group(1) + "\n", re.S)
    }


def transition_permissions(statuses: list[str], allowed: dict[str, list[str]]) -> dict[str, str]:
    """Mirror `permissionForAccountTransition`, keyed "from->to" so lookup needs no logic."""
    mapping: dict[str, str] = {}
    for source in statuses:
        for target in allowed.get(source, []):
            if target == "active":
                permission = ("admin.accounts.approve" if source == "pending_review"
                              else "admin.accounts.restore")
            elif target == "rejected":
                permission = "admin.accounts.reject"
            elif target == "suspended":
                permission = "admin.accounts.suspend"
            elif target == "blocked":
                permission = "admin.accounts.block"
            elif target == "cancelled":
                permission = "admin.accounts.cancel"
            elif target == "archived":
                permission = "admin.accounts.archive"
            else:
                permission = "admin.accounts.restore"
            mapping[f"{source}->{target}"] = permission
    return mapping


def main() -> int:
    text = SOURCE.read_text()

    roles = string_array("WEWED_ADMIN_ROLES", text)
    permissions = string_array("WEWED_ADMIN_PERMISSIONS", text)
    statuses = string_array("ACCOUNT_LIFECYCLE_STATUSES", text)
    labels = dict(re.findall(r"(\w+): '([^']+)',", 
                             re.search(r"WEWED_ADMIN_ROLE_LABELS.*?\{(.*?)\n\}", text, re.S).group(1)))
    allowed = transitions(text)

    # Every declared role and status must appear, or the parse silently lost one.
    parsed_roles = role_permissions(text, permissions)
    missing_roles = [role for role in roles if role not in parsed_roles]
    if missing_roles:
        raise SystemExit(f"FAIL: ROLE_PERMISSIONS parse dropped {missing_roles}")
    missing_statuses = [s for s in statuses if s not in allowed]
    if missing_statuses:
        raise SystemExit(f"FAIL: ACCOUNT_TRANSITIONS parse dropped {missing_statuses}")

    contract = {
        "contractVersion": CONTRACT_VERSION,
        "source": "src/lib/wewed-admin-policy.ts",
        "note": (
            "Generated from the web Admin policy module, which is what the Admin API enforces. "
            "Both native platforms assert equality against this file, so a native build cannot "
            "offer an action the server would refuse."
        ),
        "roles": roles,
        "roleLabels": {role: labels[role] for role in roles},
        "permissions": permissions,
        "rolePermissions": parsed_roles,
        "accountLifecycleStatuses": statuses,
        "accountTransitions": allowed,
        "transitionPermissions": transition_permissions(statuses, allowed),
        "restrictiveStatuses": ["rejected", "suspended", "blocked", "cancelled", "archived"],
        "workspaceStatus": "active",
    }

    # Sanity: every granted permission must be a declared one, and every transition target a
    # declared status. A typo in the policy module should fail here, not on a device.
    declared = set(permissions)
    for role, granted in contract["rolePermissions"].items():
        unknown = sorted(set(granted) - declared)
        if unknown:
            raise SystemExit(f"FAIL: role {role} grants undeclared permissions {unknown}")
    for source, targets in allowed.items():
        unknown = sorted(set(targets) - set(statuses))
        if unknown:
            raise SystemExit(f"FAIL: transition from {source} targets undeclared {unknown}")

    OUTPUT.write_text(json.dumps(contract, indent=2) + "\n")
    print(f"wrote {OUTPUT.relative_to(REPO)}")
    print(f"  roles={len(roles)} permissions={len(permissions)} "
          f"statuses={len(statuses)} transitions={sum(len(v) for v in allowed.values())}")
    for role in roles:
        print(f"  {labels[role]:<18} {len(contract['rolePermissions'][role])} permissions")
    return 0


if __name__ == "__main__":
    sys.exit(main())
