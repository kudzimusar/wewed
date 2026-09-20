#!/usr/bin/env python3
"""Derive the native invitation-style registry from the web registry.

The invitation design is a wedding-configured product object. If native's idea of the catalogue
drifts from `src/lib/digital-invitation-card.ts`, a wedding saved as one design renders as another
— which is the substitution this contract exists to prevent. So the catalogue is generated, never
retyped.

Run from the repository root:

    python3 mobile/contracts/generate_invitation_style_contract.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SOURCE = Path("src/lib/digital-invitation-card.ts")
TARGET = Path("mobile/contracts/invitation-styles.json")

# The one style native has an exact renderer for. Adding a name here is a claim that the native
# renderer reproduces that approved artwork — not that it approximates it.
NATIVE_RENDERERS = {"ivory-floral-gold"}

ENTRY = re.compile(
    r"\{\s*id:\s*'(?P<id>[a-z0-9-]+)'\s*,"
    r"\s*name:\s*'(?P<name>[^']+)'\s*,"
    r".*?category:\s*'(?P<category>[a-z]+)'\s*,"
    r"\s*motion:\s*'(?P<motion>[a-z-]+)'\s*,"
    r"\s*atmosphere:\s*'(?P<atmosphere>[a-z-]+)'",
    re.S,
)
FALLBACK = re.compile(r"STYLE_IDS\.has\(value\)[\s\S]{0,120}?:\s*'(?P<id>[a-z0-9-]+)'")


def main() -> int:
    if not SOURCE.exists():
        print(f"missing {SOURCE}", file=sys.stderr)
        return 1
    text = SOURCE.read_text()

    block = text.split("export const INVITATION_CARD_STYLES", 1)
    if len(block) != 2:
        print("could not locate INVITATION_CARD_STYLES", file=sys.stderr)
        return 1
    block = block[1].split("] as const", 1)[0]

    styles = [
        {
            "id": m.group("id"),
            "name": m.group("name"),
            "category": m.group("category"),
            "motion": m.group("motion"),
            "atmosphere": m.group("atmosphere"),
            "nativeRenderer": m.group("id") in NATIVE_RENDERERS,
        }
        for m in ENTRY.finditer(block)
    ]
    if not styles:
        print("parsed zero styles", file=sys.stderr)
        return 1

    fallback = FALLBACK.search(text)
    if not fallback:
        print("could not locate normalizeInvitationCardStyle fallback", file=sys.stderr)
        return 1

    unknown = sorted(NATIVE_RENDERERS - {s["id"] for s in styles})
    if unknown:
        print(f"NATIVE_RENDERERS names styles the web does not define: {unknown}", file=sys.stderr)
        return 1

    contract = {
        "contract": "wewed-invitation-styles/1",
        "source": str(SOURCE),
        "generatedBy": str(Path(__file__).relative_to(Path.cwd())),
        # Mirrors normalizeInvitationCardStyle: an absent or unrecognised value is NOT ivory.
        "fallbackStyleId": fallback.group("id"),
        "styles": styles,
    }
    TARGET.write_text(json.dumps(contract, indent=2) + "\n")
    rendered = sum(1 for s in styles if s["nativeRenderer"])
    print(f"{TARGET}: {len(styles)} styles, {rendered} with a native renderer, "
          f"fallback '{contract['fallbackStyleId']}'")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
