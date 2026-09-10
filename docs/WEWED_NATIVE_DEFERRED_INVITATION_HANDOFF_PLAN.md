# Wewed Phase 2 — Native Deferred Invitation Handoff

**Plan stamp:** `WW-INVITE-DEFERRED-HANDOFF-2026-09-10-01`  
**Status:** Implemented on `feature/native-deferred-invitation-handoff-20260910`; release qualification pending CI + Google Play Closed Testing.  
**Depends on:** PR #194 / `feature/smart-invitation-install-handoff-20260910`.

## Goal

A guest who opens a private Wewed invitation in WhatsApp, Facebook, Chrome, or another mobile browser must be able to install Wewed and have the newly installed Android app resume the exact invitation without relying on browser-cookie sharing.

The target journey is:

```text
Invitation link
  → Wewed validates RSVP
  → one-time server handoff created
  → Google Play receives only opaque handoff
  → install Wewed
  → Android Install Referrer reads handoff once
  → /invite/resume redeems handoff
  → Wewed guest session created
  → exact invitation opens
```

Already-installed guests continue to use Android Verified App Links and do not need Google Play Install Referrer.

## Security contract

Google Play must receive only:

```text
handoff=<43-character random opaque value>
```

It must not receive the RSVP token, guest name, guest email/phone, wedding slug, wedding title, or internal IDs.

The server stores deferred state in `private."InvitationInstallHandoff"`. The raw handoff and raw RSVP token are not persisted there: only SHA-256 hashes are stored. The handoff is single-use, expires after 24 hours by default, and is atomically consumed. Its validity is rechecked against the current RSVP record at redemption, so RSVP token rotation/deletion or guest/wedding mismatch invalidates the handoff.

Audit events use the existing `AuditEvent` model and never contain the raw handoff or RSVP credential.

## Runtime controls

Deferred installation is **off by default**. It becomes active only when:

```text
ANDROID_DEFERRED_INVITATION_HANDOFF=1
```

Optional TTL override:

```text
WEWED_INVITATION_HANDOFF_TTL_SECONDS=86400
```

The application clamps the TTL to 5 minutes–48 hours. The default is 24 hours.

This gate is essential: the server must not start issuing Play referrers until an Android build containing Install Referrer support is available to the intended Play track.

## Implementation sequence

1. Preserve PR #194 as the Phase 1 invitation/App Link baseline.
2. Add private server-side `InvitationInstallHandoff` persistence.
3. Create handoffs only from a currently valid signed pending invitation.
4. Generate a Google Play URL containing only the opaque handoff in `referrer`.
5. Make the Android install CTA request the handoff immediately before leaving for Play.
6. Protect duplicate taps, slow networks, request timeout, and failure recovery on mobile.
7. Add `com.android.installreferrer:installreferrer:2.2` to `pro.wewed.app`.
8. On ordinary first launch, asynchronously retrieve the Play Install Referrer.
9. Give explicit App Links/shortcuts precedence over an old install referrer.
10. Process the install referrer once and never log its raw content.
11. Launch `https://wewed.pro/invite/resume?h=<opaque>` when a valid handoff is found.
12. Atomically consume the handoff, revalidate RSVP state, create the existing HttpOnly Wewed guest session, and redirect to the exact invitation without `h` or `rsvp` in the final URL.
13. Rate-limit repeated handoff creation and invalid resume attempts.
14. Qualify PostgreSQL migration integrity, TypeScript paths, privacy-link tests, concurrency/replay tests, and Android compilation in CI.
15. Publish Android `versionCode 2` to Google Play Closed Testing.
16. Keep `ANDROID_DEFERRED_INVITATION_HANDOFF` disabled until the Play build is available.
17. Enable the flag in the test environment and execute the real install matrix.
18. Enable production only after the exact closed-testing candidate passes.

## Mobile behavior

The install CTA has a minimum touch target, busy state, duplicate-tap suppression, screen-reader live status, explicit error state, 20-second network timeout, and browser continuation fallback.

If deferred installation is disabled, the UI does not promise automatic resume. It shows the ordinary Play installation path and instructs the guest to return to the invitation link afterward.

Transient Play Install Referrer service failures do not block Wewed startup and can retry on a later launch. Terminal unsupported/developer responses are marked processed so they do not create repeated startup overhead.

## Automated acceptance tests

The release gate must prove:

- Play URL contains an opaque handoff only.
- Raw RSVP token and wedding slug are absent from the Play URL.
- Private handoff table stores hashes rather than raw credentials.
- Valid handoff redeems to the correct wedding/guest context.
- Second redemption is rejected.
- Expired handoff is rejected.
- RSVP token rotation revokes the outstanding handoff.
- Two simultaneous redemption attempts produce exactly one winner.
- Prisma public-schema drift remains clean after the private migration.
- Android `versionCode 2` compiles with Install Referrer 2.2.

## Google Play Closed Testing UAT

Use the exact candidate installed from Google Play; sideloading is not sufficient evidence for Install Referrer.

### Test 1 — already installed

**Action:** Install Wewed first, then tap the private invitation in WhatsApp.  
**PASS:** Android App Link opens the correct invitation directly; no Play detour.

### Test 2 — WhatsApp fresh install

**Action:** Uninstall Wewed → tap invitation in WhatsApp → choose **Install Wewed & open my invitation** → install from Play → open Wewed.  
**PASS:** Exact invitation opens automatically; no login/paste step; final URL contains no RSVP token or handoff.

### Test 3 — Facebook fresh install

Repeat Test 2 from Facebook's in-app browser.  
**PASS:** Same result without shared browser-cookie storage.

### Test 4 — Chrome fresh install

Repeat Test 2 from Chrome.  
**PASS:** Same exact invitation resumes.

### Test 5 — replay

Redeem the same handoff again.  
**PASS:** No second session is created; safe recovery path shown.

### Test 6 — expiry/revocation

Expire a handoff or rotate/revoke the RSVP before install.  
**PASS:** Invitation is not exposed; guest is directed to reopen the original invitation.

### Test 7 — later normal launches

Close and reopen Wewed after successful deferred install.  
**PASS:** Old install referrer does not force-open the invitation repeatedly.

### Test 8 — newer App Link wins

After installation, tap a different invitation.  
**PASS:** The explicit new App Link opens and the old install referrer does not override it.

## Release gate

Phase 2 is complete only after all automated checks pass and the real Google Play Closed Testing matrix proves:

```text
Installed guest → App Link → exact invitation
Uninstalled guest → handoff → Google Play → Install Referrer → exact invitation
```

Only then should `ANDROID_DEFERRED_INVITATION_HANDOFF=1` be enabled in production.
