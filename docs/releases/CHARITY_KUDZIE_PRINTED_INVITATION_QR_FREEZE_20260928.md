# Charity & Kudzie Printed Invitation QR — Production Freeze

**Status:** ACTIVE PRODUCTION ARTIFACT — DO NOT ROTATE OR REPOINT WITHOUT OWNER APPROVAL  
**Date frozen:** 2026-09-28  
**Wedding:** Charity & Kudzie  
**Wedding date:** 23 December 2026

## Printed artifact

The physical invitation cards have already been printed with this shared invitation entry:

- Display code: `JXVAA-X6DRL`
- Raw route code: `JXVAAX6DRL`
- Production URL: `https://wewed.pro/i/JXVAAX6DRL`
- Destination identity contract: `print_JXVAAX6DRL`

The QR pixels on the printed cards are now immutable. Software releases must remain compatible with them.

## Required behaviour

A scan must continue to:

1. resolve the active C&K `physical_invitation` QR destination;
2. grant only shared/read-only invitation authority;
3. open the Charity & Kudzie invitation experience using the wedding's server-authoritative invitation style;
4. never impersonate a personal Guest or expose an RSVP credential;
5. allow the holder to identify/claim themselves through the governed invitation flow where supported;
6. keep the Wedding Pass separate — this printed QR is not venue-admission authority;
7. preserve browser continuation even when native install/deferred handoff is unavailable.

The normal scan counter may increment. That analytics write is not an RSVP, check-in, token rotation, or Guest mutation.

## Release guard

Until the wedding and post-event archival period are complete, do not:

- rotate the code;
- deactivate its `QRDestination`;
- delete or rename the `/i/[code]` route;
- alter the code-normalization algorithm incompatibly;
- repoint the code to another wedding;
- reinterpret this QR as a personal Guest credential or Wedding Pass.

Any exceptional change requires explicit owner approval and a scan test of an actual printed card before release.

## Acceptance requirement

Every production release touching invitation, routing, Guest access, cookies, App Links, PWA, or native handoff must include a smoke test of the exact printed QR on at least:

- Android browser;
- iOS/Safari browser;
- and the current native-app handoff where supported.

The personal digital invitation and the shared printed-card QR are separate entry authorities. They may converge into the same wedding experience only after the server has established the correct authority.
