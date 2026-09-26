# QRO02B2 / CERT02 — Final Independent Charity & Kudzie Ivory Live Parity Certification

## Repository
`kudzimusar/wewed`

## Role
You are the **independent certification agent**.

You must not patch tracked product/test source. If certification exposes a defect:
`certifier -> moderator -> implementation/closure -> re-certification`.

## Authoritative state

Active integration branch:
`integration/phase13-live-account-data-convergence-20260926`

Required integration HEAD:
`ba38a3624581899a4999ac8d221346ec11a1f504`

Production web main:
`646f08421d778cf6f85bf12195581228ae3fbccc`

Production canonical Planner deployment:
`dpl_ApFS83c3F2MtqNFvCQEF8Pdg1UwL`
target: Production
aliases include:
`wewed.pro`
`www.wewed.pro`

Moderator decision:
**D-078 — INV-CANON01 activation and production promotion moderator review**

## Product state to certify

Charity & Kudzie's intended and now-activated invitation authority is:

`ivory-floral-gold`

The canonical invitation is the approved ornate native/web artwork:
- sculpted ivory floral doors;
- champagne/gold edging;
- circular centre seal;
- “A SPECIAL INVITATION AWAITS”;
- “Tap to open”;
- CLOSED -> OPENING -> OPEN -> DETAILS.

Do not accept Botanical/Garden Romance as parity.

Do not accept a flat generic catalogue card as the Guest invitation.

## Secure credentials

Use only:
`~/.wewed-qa/qro02b.env`

Read it with a literal KEY=VALUE parser.

Do not shell-source it.

Do not print values.

Do not read:
`~/.wewed-qa/admin.env`

Keep:
`WEWED_PARITY_ALLOW_PASS_GET`
unset.

## Preflight

Before real credentials:

1. fetch remote;
2. prove integration HEAD is exactly `ba38a3624581899a4999ac8d221346ec11a1f504`;
3. verify production main is `646f08421d778cf6f85bf12195581228ae3fbccc`;
4. verify the current integration Preview is READY and serving exact `ba38a362...`;
5. verify production canonical deployment is READY;
6. run credential-free parity preflight;
7. confirm Wedding Day remains `BLOCKED-ACTIVATION`;
8. confirm dedicated clean iOS simulator and Android emulator/device contain only/explicitly target the intended DEBUG productionPreview build for `wewed://`.

If integration moved unexpectedly, STOP and return moderator.

## No-write boundary

Wedding business-data writes authorized:

**0**

Forbidden:
- RSVP mutation;
- invitation style mutation;
- invitation token rotation;
- Guest edits;
- party/seating edits;
- Wedding date edits;
- Pass GET capable of issuance;
- Pass issue/revoke;
- Gate/check-in writes;
- WW2 activation;
- environment changes;
- production deployment;
- source patching;
- merge to main;
- store publication.

Authentication/session creation and read-only queries are allowed.

## Certification A — production Planner canonical source

Do not trigger a production mutation merely to visually verify the studio.

Verify from the deployed source identity and safe read-only evidence that production main contains:
- `CANONICAL_INVITATION_STYLE = 'ivory-floral-gold'`;
- canonical tile uses `/invitation-art/ivory/closed-master.webp`;
- the Ivory tile does not use the generic `DigitalInvitationCard`;
- interactive Ivory still dispatches to `IvoryFloralGoldTriFold`.

If a production browser check would invoke the legacy token-backfill POST, do not perform it unless you can first prove it will perform zero wedding business-data writes. Source/deployment identity is acceptable evidence for this subcheck.

## Certification B — real server authority

Using the real Guest invitation and real Planner account, collect read-only authority from the exact integration Preview.

Prove:
- same Charity & Kudzie wedding ID;
- same real Guest ID;
- RSVP = pending unless live state has legitimately changed since the prior run;
- same server-computed party size;
- same seating-table authority ID;
- invitationStyle = `ivory-floral-gold`;
- invitation message digest;
- Planner accessUserId;
- Planner grant/membership/permissions;
- same wedding relationship.

Use the revised `wewed.parity.v1` actor-specific requirements.

## Certification C — real Guest web/PWA

Use the same existing private Guest credential.

Important:
- the original credential may still have a stale `card=botanical` query parameter;
- do not rotate it;
- prove the server-authoritative saved style wins;
- the Guest journey must render `ivory-floral-gold`.

Required visible states:
- CLOSED approved ornate floral gateway;
- OPENING;
- OPEN;
- DETAILS.

Hard failures:
- Garden Romance/Botanical;
- flat generic card;
- raw ISO date;
- Home/workspace before invitation;
- token rotation needed.

## Certification D — iOS

Build from exact integrated source `ba38a362...`.

Use DEBUG `productionPreview` only.

Clean/dedicated simulator.

Prove:
- explicit Guest link -> Wewed splash;
- no ordinary workspace before invitation;
- CLOSED ornate gateway;
- OPENING;
- OPEN;
- DETAILS;
- real Guest personalization;
- `invitation-style-ivory-floral-gold`;
- no GenericMotion fallback;
- no raw ISO date;
- same weddingId/guestId/RSVP/party/table/style authority as server;
- parity export contains no secret material.

Capture OPENING evidence this time if tooling permits. If not, runtime state transition plus deterministic test evidence must be explicit and classified separately.

## Certification E — Android

Build from exact integrated source `ba38a362...`.

Use DEBUG `productionPreview`.

Use explicit component or otherwise prove only intended build receives the link.

Prove the same requirements as iOS:
- splash;
- CLOSED;
- OPENING;
- OPEN;
- DETAILS;
- `invitation-style-ivory-floral-gold`;
- no Botanical;
- no GenericMotion;
- no raw ISO date;
- same authority values;
- secret-free parity export.

## Certification F — account/workspace parity

Where supported by the native parity exporter, certify the real Planner account and the Planner-side view of the Guest.

Required labels:
- `G`;
- `P`;
- `G-VIA-P`.

Minimum required clients:
- `G`: desktop, ios, android;
- `P`: desktop, native-api;
- `G-VIA-P`: desktop, native-api.

If iOS/Android account-workspace exports for `P` or `G-VIA-P` are supported by the integrated build, include them and require them too; do not fabricate records if that exporter path does not exist.

Use:
`--same-wedding G,G-VIA-P,P`

Wedding Day blocker must be represented as:
`BLOCKED-ACTIVATION`

not as a fake `passAvailability` business value.

Final checker must return:
`wewed.parity.v1 PASS`

for the actor-specific requirements actually declared.

## Production safety check

During the native qualification window verify:
- integration Preview receives the intended Guest-session requests;
- production receives **zero** accidental native qualification invitation-exchange requests.

If production receives one unexpectedly:
classify **FALSE / STALE** and STOP.

## Evidence / receipt

Create:
`docs/QRO02B2_CERT02_FINAL_IVORY_LIVE_PARITY_RECEIPT_20260927.md`

Certification receipt only; do not patch product/test source.

Include:
- exact integration SHA;
- exact Preview deployment ID/URL;
- production main/deployment identity;
- credential source category only;
- server authority safe IDs/digests;
- web Guest result;
- iOS result;
- Android result;
- declared requiredClientsByLabel;
- exact parity checker output;
- Wedding Day blocker;
- production request count during qualification;
- explicit `Wedding business-data writes: 0`;
- unresolved evidence gaps if any.

No raw password, RSVP token, invitation URL, cookie, bearer, bypass or session secret.

## Completion

Success:
`QRO02B2 FINAL CHARITY & KUDZIE IVORY LIVE PARITY CERTIFIED — WEB/NATIVE API/IOS/ANDROID RESOLVE ONE AUTHORITY — 0 WEDDING BUSINESS-DATA WRITES — RETURNING TO MODERATOR FOR QRO03 RELEASE DECISION.`

Failure:
`QRO02B2 FINAL IVORY LIVE PARITY <NOT PROVEN|BLOCKED-ENV|BLOCKED-ACTIVATION|FALSE / STALE> — <exact one-line reason> — RETURNING TO MODERATOR.`
