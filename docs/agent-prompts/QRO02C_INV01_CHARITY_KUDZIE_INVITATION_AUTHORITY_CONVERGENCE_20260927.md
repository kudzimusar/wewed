# QRO02C / INV01 — Charity & Kudzie Invitation Authority Convergence

Status: **QUEUED — DO NOT EXECUTE UNTIL QRO02B RETURNS AND MODERATOR RELEASES THIS UNIT**

Repository: `kudzimusar/wewed`

Authoritative product branch at queue time:
`integration/phase13-live-account-data-convergence-20260926`

Expected QRO02B starting head at queue time:
`5e7a3162b910258ad1c88e5600543e556ad7ecc2`

## Moderator product decision

The intended Charity & Kudzie Digital Invitation is:

`ivory-floral-gold`

The native Ivory Floral Gold experience already exists and has been separately qualified as the intended invitation presentation.

The live Guest invitation must not remain on `botanical` once this closure unit is authorized.

## Why this unit exists

Current personal invitation URLs may contain:

`card=botanical`

but that query parameter is not final authority. Current server code deliberately resolves the saved wedding `invitationCardStyle` and ignores stale/edited link card selectors.

QRO02B is read-only and must first establish the actual live value and cross-client behavior.

## Release trigger

Moderator may release this unit only if QRO02B proves one of:

1. Charity & Kudzie live `Wedding.invitationCardStyle` is `botanical`, null/invalid, or otherwise not `ivory-floral-gold`;
2. live server says `ivory-floral-gold` but production web/native renders another style;
3. generated/canonical links remain stale after live authority has been changed.

## Mission

Converge Charity & Kudzie so the one saved invitation authority is:

`Wedding.invitationCardStyle = ivory-floral-gold`

and prove:

`PWA/web invitation = iOS invitation = Android invitation = Ivory Floral Gold`

for the same existing Guest credential.

## Important invariant

Do not make native clients hardcode Ivory.

Native and web must continue to render the server-authoritative saved style.

Do not change global default behavior merely to make Charity & Kudzie pass.

## Existing-link behavior

Do not rotate the Guest RSVP/invitation token merely because an old URL contains `card=botanical`.

The existing credential should remain valid. After the wedding's saved style becomes `ivory-floral-gold`, the same valid personal invitation must resolve/render the saved Ivory style.

Newly copied/generated invitation links should advertise `card=ivory-floral-gold`.

## Controlled write boundary

This unit authorizes at most one intended Charity & Kudzie invitation-configuration change when explicitly released:

- invitation style: `botanical/other -> ivory-floral-gold`.

Before the write, snapshot:
- invitationCardStyle;
- invitationCardMessage;
- rsvpDeadline;
- childrenPolicy.

Preserve all fields except the style unless the owner separately authorizes another change.

Prefer the normal Couple/Planner invitation-management authority/API over direct database mutation.

Do not:
- rotate Guest tokens;
- change RSVP state;
- edit Guest identity;
- change wedding date;
- change Pass/Gate state;
- activate WW2;
- deploy production code merely for this data/config change;
- modify unrelated weddings.

## Qualification

After the controlled style change, prove with the same existing Guest credential:

1. server-authoritative invitation snapshot reports `ivory-floral-gold`;
2. production web personal invitation renders Ivory Floral Gold;
3. Preview/native API reports the same saved style;
4. iOS productionPreview renders `invitation-style-ivory-floral-gold`;
5. Android productionPreview renders `invitation-style-ivory-floral-gold`;
6. RSVP state, guestId, weddingId, party size and seating authority are unchanged;
7. old personal link remains valid even if its stale query contains `card=botanical`;
8. newly copied invitation link contains `card=ivory-floral-gold`;
9. no invitation token rotation occurred.

## Receipt

Create:
`docs/QRO02C_INV01_CHARITY_KUDZIE_INVITATION_AUTHORITY_CONVERGENCE_RECEIPT_20260927.md`

Record:
- pre-value;
- post-value;
- preserved invitation fields;
- same Guest token digest before/after;
- web renderer result;
- iOS renderer result;
- Android renderer result;
- generated-link card selector after update;
- exact wedding business-data write count;
- all source changes, if any.

## Completion

Success:
`QRO02C CHARITY & KUDZIE INVITATION AUTHORITY CONVERGED TO IVORY FLORAL GOLD — EXISTING GUEST CREDENTIAL PRESERVED — RETURNING TO MODERATOR.`

Failure:
`QRO02C INVITATION AUTHORITY CONVERGENCE NOT PROVEN — <exact reason> — RETURNING TO MODERATOR.`
