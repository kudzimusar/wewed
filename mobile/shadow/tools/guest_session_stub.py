#!/usr/bin/env python3
"""A stand-in for Wewed's guest-session API, for driving the native guest-only shell.

The shell talks to `wewed.pro` in production. To exercise the real Activity, the real
`onNewIntent`, the real splash and the real card on a device, it needs somewhere to talk to that
answers like production but is not production.

Two guests are served, because the defect this was built to catch is Guest B arriving while Guest
A's card is on screen. A stub with one guest cannot tell "replaced correctly" from "did nothing".

    python3 mobile/shadow/tools/guest_session_stub.py --port 8787

The emulator reaches the host at 10.0.2.2, so the app is pointed at
`http://10.0.2.2:8787` with the debug-only `wewed_guest_base_url` extra.
"""
from __future__ import annotations

import argparse
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer

SLUG = "charity-and-kudzie"

# Keyed by the credential a link carries. Deliberately two different people.
GUESTS = {
    "TOKEN-A": {"id": "guest_a", "name": "Guest A Stub", "session": "SESSION-A"},
    "TOKEN-B": {"id": "guest_b", "name": "Guest B Stub", "session": "SESSION-B"},
}

# The active session, as the server sees it. RSVP writes are checked against it.
STATE: dict[str, object] = {"session": None, "rsvp": {}}


def guest_for_session(session: str | None):
    for guest in GUESTS.values():
        if guest["session"] == session:
            return guest
    return None


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # Quiet: the test output is the interesting part.
        pass

    def _send(self, status, body=None, session=None, location=None):
        payload = json.dumps(body).encode() if body is not None else b""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        if session:
            self.send_header("Set-Cookie", f"wewed_wedding_guest={session}; Path=/; HttpOnly")
        if location:
            self.send_header("Location", location)
        self.end_headers()
        if payload:
            self.wfile.write(payload)

    def _session(self):
        cookie = self.headers.get("Cookie") or ""
        match = re.search(r"wewed_wedding_guest=([^;]+)", cookie)
        return match.group(1) if match else None

    def do_GET(self):
        if self.path.startswith("/api/weddings/") and self.path.endswith("/guest-session"):
            guest = guest_for_session(self._session())
            if not guest:
                return self._send(401, {"success": False, "authorized": False})
            return self._send(200, {
                "success": True, "authorized": True,
                "wedding": {
                    "slug": SLUG, "title": "Charity & Kudzie", "monogram": "C&K",
                    "tagline": "23.12.26", "date": "2026-12-23T14:00:00",
                    "venue": "Imba Manor", "venueCity": "Harare", "venueCountry": "Zimbabwe",
                    "venueMapUrl": None, "invitationCardStyle": "ivory-floral-gold",
                    "invitationCardMessage": "We would be honoured to have you with us.",
                    "rsvpDeadline": None, "childrenPolicy": "welcome",
                },
                "guest": {"id": guest["id"], "name": guest["name"]},
                "rsvp": {"attending": STATE["rsvp"].get(guest["id"]), "checkedIn": False},
            })
        return self._send(404)

    def do_POST(self):
        if self.path.startswith("/api/weddings/") and self.path.endswith("/guest-session"):
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            guest = GUESTS.get(body.get("token"))
            if not guest:
                return self._send(401, {"success": False, "error": "invalid"})
            STATE["session"] = guest["session"]
            return self._send(
                200,
                {"success": True, "authorized": True, "wedding": {"slug": SLUG},
                 "guest": {"id": guest["id"], "name": guest["name"]}},
                session=guest["session"],
            )
        return self._send(404)

    def do_PUT(self):
        if self.path.startswith("/api/weddings/") and self.path.endswith("/guest-session"):
            guest = guest_for_session(self._session())
            if not guest:
                return self._send(401, {"success": False})
            length = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(length) or b"{}")
            # The binding the real server enforces: an answer typed as one guest must not land on
            # another after the session has moved on.
            if body.get("originGuestId") != guest["id"]:
                return self._send(409, {"success": False, "code": "STALE_GUEST_CONTEXT"})
            STATE["rsvp"][guest["id"]] = body.get("attending")
            return self._send(200, {"success": True, "rsvp": {"attending": body.get("attending")}})
        return self._send(404)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8787)
    args = parser.parse_args()
    server = HTTPServer(("0.0.0.0", args.port), Handler)
    print(f"guest-session stub on :{args.port} (emulator: http://10.0.2.2:{args.port})", flush=True)
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
