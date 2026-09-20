#!/usr/bin/env python3
"""Measure the native mobile contract against the Wewed backend that already exists.

WHY
    The native app grew a broad information architecture over a narrow data contract, and the
    gap was invisible because it was recorded in prose. Two "authoritative" documents claimed
    parity for authentication that does not exist; `mobile/contracts/openapi.yaml` still described
    `/auth/login`, a route the backend does not have, while the real mobile auth surface is
    `/api/mobile/auth/{signin,me,signout,wedding}`.

    A hand-written parity matrix decays the moment someone ships a route. This counts, from the
    filesystem, what the backend actually exposes and what the mobile contract actually covers.

THE RULE IT ENFORCES
    If Wewed web has a database-backed capability, the native app must consume the same canonical
    service or the route is a gap. "Unsupported" is legitimate only when Wewed itself lacks the
    capability — never when native has simply not wired it.

Output is a coverage table by backend area, and a machine-readable ledger for the parity document.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
API_ROOT = REPO / "src" / "app" / "api"
CONTRACT = REPO / "mobile" / "contracts" / "openapi.yaml"
LEDGER = REPO / "mobile" / "contracts" / "mobile-api-coverage.json"

# HTTP verbs a Next.js route file may export.
VERBS = ("GET", "POST", "PUT", "PATCH", "DELETE")

# Backend areas, in the order the parity ledger reports them.
AREAS = [
    "mobile", "admin", "planner", "vendor", "weddings", "guests", "rsvp",
    "invitations", "contributions", "bookings", "payments", "auth", "internal",
]


def route_path(route_file: Path) -> str:
    """The URL a route file serves."""
    rel = route_file.parent.relative_to(API_ROOT)
    return "/api/" + str(rel) if str(rel) != "." else "/api"


def area_of(url: str) -> str:
    parts = [p for p in url.split("/") if p and p != "api"]
    if not parts:
        return "other"
    head = parts[0]
    return head if head in AREAS else "other"


def operations(route_file: Path) -> list[str]:
    """Which verbs this route exports. One file often serves several operations."""
    text = route_file.read_text(errors="ignore")
    return [v for v in VERBS if re.search(rf"export\s+(async\s+)?function\s+{v}\b", text)]


def contract_paths() -> list[str]:
    if not CONTRACT.is_file():
        return []
    # Paths are the two-space-indented keys under `paths:`.
    text = CONTRACT.read_text()
    block = text.split("paths:", 1)[-1]
    return re.findall(r"^  (/[^\s:]*):", block, re.M)


def main() -> int:
    if not API_ROOT.is_dir():
        print(f"FAIL: backend API root not found at {API_ROOT}")
        return 2

    routes = sorted(API_ROOT.rglob("route.ts"))
    by_area: dict[str, list[dict]] = defaultdict(list)
    total_ops = 0

    for route_file in routes:
        url = route_path(route_file)
        ops = operations(route_file)
        total_ops += len(ops)
        by_area[area_of(url)].append({"path": url, "operations": ops})

    covered = contract_paths()

    print("=" * 78)
    print("WEWED BACKEND -> NATIVE MOBILE CONTRACT COVERAGE")
    print("=" * 78)
    print(f"Backend route files : {len(routes)}")
    print(f"Backend operations  : {total_ops}")
    print(f"Mobile contract paths: {len(covered)}")
    if total_ops:
        print(f"Contract coverage   : {len(covered) / total_ops:.1%} of backend operations")
    print()
    print(f"{'AREA':<16}{'ROUTES':>8}{'OPERATIONS':>12}   STATUS")
    print("-" * 78)

    ledger = {}
    for area in AREAS + ["other"]:
        entries = by_area.get(area, [])
        if not entries:
            continue
        ops = sum(len(e["operations"]) for e in entries)
        # The mobile contract is judged by whether it names anything in this area at all.
        named = sum(1 for p in covered if area in p) if area != "other" else 0
        status = "MOBILE ADAPTER MISSING" if named == 0 else f"{named} contract path(s)"
        print(f"{area:<16}{len(entries):>8}{ops:>12}   {status}")
        ledger[area] = {
            "routeFiles": len(entries),
            "operations": ops,
            "contractPaths": named,
            "classification": "MOBILE_ADAPTER_MISSING" if named == 0 else "PARTIAL",
            "routes": entries,
        }

    print("-" * 78)

    # The contract's own honesty: does every path it declares exist in the backend?
    backend_urls = {route_path(f) for f in routes}
    stale = [p for p in covered if not any(u.endswith(p) or p in u for u in backend_urls)]
    print()
    if stale:
        print("CONTRACT PATHS WITH NO BACKEND ROUTE (stale contract):")
        for p in stale:
            print(f"   {p}")
    else:
        print("Every contract path resolves to a backend route.")

    LEDGER.write_text(json.dumps({
        "generatedFrom": "src/app/api/**/route.ts",
        "backendRouteFiles": len(routes),
        "backendOperations": total_ops,
        "mobileContractPaths": len(covered),
        "staleContractPaths": stale,
        "areas": ledger,
    }, indent=2) + "\n")
    print(f"\nwrote {LEDGER.relative_to(REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
