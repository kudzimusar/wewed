#!/usr/bin/env python3
"""Derive the native invitation-entry protocol from the production web implementation.

The private invitation is a security protocol, not a URL convention. Native must speak the one
that already exists — the same handoff shape, the same endpoints, the same refusals — rather than
a second protocol that happens to look similar. So the constants are extracted from the canonical
modules and asserted on both platforms instead of being retyped.

Run from the repository root:

    python3 mobile/contracts/generate_invitation_protocol_contract.py
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

TARGET = Path("mobile/contracts/invitation-protocol.json")

# The canonical modules. `origin/main` is the authority: the native branch must not be able to
# drift the protocol by editing its own copy of these files.
LINKS = "src/lib/invitation-links.ts"
GUEST_SESSION = "src/app/api/weddings/[slug]/guest-session/route.ts"
RESUME = "src/app/invite/resume/route.ts"


def read(path: str) -> str:
    result = subprocess.run(
        ["git", "show", f"origin/main:{path}"], capture_output=True, text=True
    )
    if result.returncode != 0:
        raise SystemExit(f"cannot read origin/main:{path}")
    return result.stdout


def _product(expression: str) -> int:
    total = 1
    for part in expression.split("*"):
        total *= int(part.strip())
    return total


def one(pattern: str, text: str, what: str) -> str:
    match = re.search(pattern, text)
    if not match:
        raise SystemExit(f"could not locate {what}")
    return match.group(1)


def main() -> int:
    links = read(LINKS)
    session = read(GUEST_SESSION)
    resume = read(RESUME)
    session_lib = read("src/lib/wedding-guest-session.ts")

    handoff_pattern = one(
        r"const INVITATION_HANDOFF_PATTERN = /\^(.+?)\$/", links, "handoff pattern"
    )
    physical_pattern = one(
        r"const PHYSICAL_INVITATION_HANDOFF_PATTERN = /\^(.+?)\$/",
        links,
        "physical handoff pattern",
    )
    package = one(r"export const ANDROID_PACKAGE = '([^']+)'", links, "Android package")

    # The Android bridge intent. Native reads the extra; it must never read `rsvp`.
    intent_extra = one(r"S\.([a-z_]+)=\$\{encodeURIComponent\(handoff\)\}", links,
                       "Android intent handoff extra")
    referrer_key = one(
        r"const referrer = new URLSearchParams\(\{ (handoff) \}\)", links, "Play referrer key"
    )
    resume_path = one(r"resume\.pathname !== '([^']+)'", links, "resume path")
    resume_param = one(
        r"buildInvitationResumePath[\s\S]{0,300}?URLSearchParams\(\{ (\w+): handoff \}\)",
        links,
        "resume query parameter",
    )

    contract = {
        "contract": "wewed-invitation-protocol/1",
        "authority": "origin/main",
        "sources": [LINKS, GUEST_SESSION, RESUME],
        "generatedBy": str(Path(__file__).relative_to(Path.cwd())),
        "androidPackage": package,
        "handoff": {
            # 43 base64url characters == 32 random bytes. Native validates the shape before it
            # ever puts the value on the wire, so a malformed launch fails locally and silently.
            "secretPattern": handoff_pattern,
            "physicalSecretPattern": physical_pattern,
            "resumePath": resume_path,
            "resumeQueryParam": resume_param,
            "androidIntentExtra": intent_extra,
            "playInstallReferrerKey": referrer_key,
            # `buildAndroidInvitationIntentUrl` refuses a resume URL carrying `rsvp`. Native must
            # refuse the same thing: a resume link is an opaque handoff, never a raw credential.
            "forbiddenResumeParam": "rsvp",
        },
        "entry": {
            "inviteePath": "/invite/{weddingSlug}",
            "inviteeQueryParam": "rsvp",
            # The saved wedding design wins over any `card` in the link, which may be stale or
            # forwarded. `resolvePersonalInvitation` enforces this server-side.
            "cardQueryParamIsAdvisoryOnly": True,
        },
        "guestSession": {
            "path": "/api/weddings/{weddingSlug}/guest-session",
            # POST exchanges the private invitation credential for a session and returns identity
            # as JSON. This is the native entry point: one authority, not a second auth model.
            "exchange": {"method": "POST", "body": ["token"],
                         "returns": ["success", "authorized", "wedding.slug", "guest.id", "guest.name"]},
            "read": {"method": "GET",
                     "returns": ["wedding", "guest", "rsvp"]},
            "save": {"method": "PUT",
                     "body": ["originGuestId", "attending", "mealChoice", "plusOne", "plusOneName",
                              "plusOneMeal", "kidsAttending", "kidsCount", "dietaryNotes", "message"],
                     "staleGuestCode": "STALE_GUEST_CONTEXT",
                     "childrenBlockedCode": "CHILDREN_NOT_ALLOWED"},
            "sessionCookie": one(
                r"WEDDING_GUEST_SESSION_COOKIE = '([^']+)'", session_lib,
                "guest session cookie name"),
            # Written as an expression on the server; evaluated here so the two cannot disagree.
            "sessionTtlSeconds": _product(one(
                r"WEDDING_GUEST_SESSION_TTL_SECONDS = ([\d\s*]+)",
                session_lib, "guest session ttl")),
        },
        "clientRules": [
            "The raw RSVP credential is for entry and exchange only. It is never persisted as "
            "client identity, never logged, and never placed in a resume URL.",
            "A resume URL carrying `rsvp` is refused, mirroring buildAndroidInvitationIntentUrl.",
            "A fresh explicit invitation launch outranks a stale install referrer.",
            "The install referrer is marked processed before it is acted on, so an interrupted "
            "launch cannot replay it.",
            "Guest replacement is atomic: the new invitation is validated by the server before "
            "the active guest is replaced. An invalid link never clears a valid session.",
        ],
    }

    TARGET.write_text(json.dumps(contract, indent=2) + "\n")
    print(f"{TARGET}: handoff /{handoff_pattern}/, resume {resume_path}?{resume_param}=, "
          f"intent extra {intent_extra}, referrer key {referrer_key}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
