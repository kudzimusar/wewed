# Guest Pass — backend contract proposal

**Task stamp:** `WW-NATIVE-LIVE-GUEST-INVITATION-UAT-2026-09-21-02`
**Status:** Release blocker for the Guest Pass CTA. Not a native gap.

---

## 1. The finding

There is **no production authority that issues a guest admission credential.**

Traced on `origin/main@ba4b08f8`:

| Checked | Result |
|---|---|
| `wedding-guest-pass-dialog.tsx` | Reads `/api/weddings/{slug}/guest-session`. Renders guest name, table number, and a checked-in/ready badge |
| Its `QrCode` | A `lucide-react` **icon**, `aria-hidden="true"` — decoration, not a scannable code |
| `GET /api/weddings/{slug}/guest-session` | Returns no QR, serial, admission token or expiry |
| Any `/api/**/pass` route | None exists |
| Anything issuing a `WW2.` credential | None exists |

Native, meanwhile, already **verifies** a credential format. `TokenVerifier` parses and checks
`WW2.<weddingShortId>.<passSerial>.<eventBitmask>.<nonce>.<signature>`, enforces an event bit, and
both platforms refuse to render a QR that does not carry the `WW2.` prefix.

So the verification half is built and tested, and the issuing half does not exist. That asymmetry
is the whole gap.

## 2. Why native will not close it locally

The obvious shortcut is to encode something native already holds. Every candidate is unsafe:

| Candidate | Why not |
|---|---|
| RSVP token | It is the invitation credential. Putting it on a screen a stranger can photograph turns a private key into a public one. |
| Guest id | Unauthenticated and guessable-adjacent; anyone who learns one could be admitted. |
| Email / name | Not secret, and not proof of anything. |
| A client-generated signature | The signing key would have to ship in the app, which makes it not a signature. |

A credential is only meaningful if the party checking it can tell that the party issuing it is the
server. None of the above can.

## 3. The proposal

One endpoint, shaped like the guest-session surface it sits beside.

```
GET /api/weddings/{slug}/guest-session/pass
```

**Authentication:** the existing `wewed_wedding_guest` session, exactly as `GET guest-session`.
No new auth model.

**Refusals:**

| Condition | Response |
|---|---|
| No active guest session | `401` |
| Guest has not accepted | `409 { code: "RSVP_NOT_ATTENDING" }` — a declined or pending guest has no pass |
| Wedding has no gate configured | `404 { code: "NO_ADMISSION_CONFIGURED" }` |

**Success:**

```json
{
  "success": true,
  "pass": {
    "credential": "WW2.<weddingShortId>.<passSerial>.<eventBitmask>.<nonce>.<signature>",
    "passSerial": "WWJD0824",
    "partySize": 2,
    "tableName": "Table 1 — Family",
    "expiresAt": "2026-12-24T02:00:00.000Z"
  }
}
```

**The credential**, matching what native already verifies:

- `weddingShortId` — a per-wedding code, not the database id
- `passSerial` — the pass's own identifier, safe to show and to read aloud at a gate
- `eventBitmask` — which events this admits to, so one credential cannot open every door
- `nonce` — per-issue, so a photographed screenshot is not indefinitely replayable
- `signature` — HMAC-SHA256 over `version.weddingShortId.passSerial.eventBitmask.nonce`, truncated
  to 16 bytes as `TokenVerifier` expects, keyed by a **server-held** secret

**Not in the payload:** the RSVP token, the guest id, the email, the name. The credential proves
admission; the pass screen renders identity separately from data the guest session already returns.

## 4. What native does when this lands

Nothing structural. `WeddingPass.qrPayload` already expects a `WW2.` credential, both pass screens
already refuse to render anything else, and `TokenVerifier` already checks it. The live coordinator
gains one call and the `invitation-cta-pass` CTA stops being nil.

## 5. Until then

`onViewPass` is `nil` on the live path, deliberately. The CTA is absent rather than present and
broken, and this file is the reason.

**This is a backend deliverable, and the Guest Pass lane of the live UAT cannot pass without it.**
