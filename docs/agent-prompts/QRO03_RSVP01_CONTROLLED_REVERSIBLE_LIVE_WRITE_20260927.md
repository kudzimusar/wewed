# QRO03 / RSVP01 — Controlled Reversible Real Charity & Kudzie RSVP Write

## Repository

`kudzimusar/wewed`

Authoritative integration branch:

`integration/phase13-live-account-data-convergence-20260926`

Required starting HEAD:

`fb2e2f2483c15c99e63e3a3e7219a6f63b821e17`

Required starting Preview:

`dpl_93NtUPp41dmQQExo2MUDjLkuHi74`

Expected Preview URL:

`wewed-8kz7ymsle-11-11.vercel.app`

Moderator decision:

**D-079 — QRO02B2 final Ivory certification accepted; QRO03 released**

## Agent role

You are the QRO03 implementation/qualification agent.

This unit is a controlled live-write qualification.

You may configure the exact branch-scoped Preview write corridor described below and perform the exact reversible RSVP mutation described below.

Do not broaden the write.

Do not perform Pass/Gate work.

Return to the moderator for independent review.

## Mission

Prove END-TO-END Charity & Kudzie RSVP convergence:

`native Guest write -> authoritative RSVP row -> Planner/Couple read -> other native read -> restoration -> all clients return to pre-state`.

Use one reversible RSVP **message-only** mutation.

Do not change attendance.

Do not change party size.

Do not change seating.

Do not change invitation style.

Do not issue a Wedding Pass.

## Why message-only

The real designated Guest is currently RSVP `pending`.

Changing attendance would alter Pass lifecycle semantics and is not required to prove write convergence.

The shared Guest RSVP operation supports partial updates.

Therefore QRO03 must mutate only:

`RSVP.message`

using the native Guest Session client.

The test marker must be short, non-secret and unmistakably synthetic, for example:

`QRO03 live convergence check`

Do not include names, emails, tokens or credentials in the marker.

## Secure credentials

Use only:

`~/.wewed-qa/qro02b.env`

Read it as literal KEY=VALUE data.

Do not shell-source it.

Do not print secret values.

Do not read:

`~/.wewed-qa/admin.env`

Keep:

`WEWED_PARITY_ALLOW_PASS_GET`

unset.

## Pre-edit / pre-write verification

Before any environment or data mutation:

1. fetch remote;
2. verify integration HEAD is exactly:
   `fb2e2f2483c15c99e63e3a3e7219a6f63b821e17`;
3. verify Preview `dpl_93NtUPp41dmQQExo2MUDjLkuHi74` is READY and serves that exact SHA;
4. verify production main remains `646f08421d778cf6f85bf12195581228ae3fbccc`;
5. verify Charity & Kudzie authority:
   - wedding ID = the same certified QRO02B2 wedding;
   - Guest ID = the same certified QRO02B2 Guest;
   - invitation style = `ivory-floral-gold`;
6. take a complete pre-snapshot of the target Guest's RSVP:
   - attending;
   - mealChoice;
   - plusOne;
   - plusOneName;
   - plusOneMeal;
   - kidsAttending;
   - kidsCount;
   - dietaryNotes;
   - message;
   - checkedIn;
   - checkedInAt;
   - server-computed partySize;
   - seatingTableId;
   - invitation style;
   - Guest token digest only, never raw token;
7. prove the Preview currently refuses an RSVP write with `423 PREVIEW_WRITE_BLOCKED`.

If the pre-state differs materially from the QRO02B2 certified state, STOP and return moderator before mutation.

## Authorized Preview write corridor

The integration Preview shares the live database and is read-only by default.

For this unit only, you are authorized to set:

`WEWED_PREVIEW_WRITABLE_WEDDING_ID=<exact Charity & Kudzie wedding id>`

with these restrictions:

- Preview target only;
- integration branch scope only;
- no Production scope;
- no other wedding ID;
- no WW2/ROOT/session-secret changes;
- no database credential changes.

After changing the branch-scoped Preview environment:

1. redeploy the exact integration source SHA;
2. record deployment ID/URL;
3. prove the deployment is READY;
4. prove it serves exact source `fb2e2f24...`;
5. prove a safe write guard for any different wedding remains blocked;
6. do not perform the live RSVP mutation until all above checks pass.

## Native writer

Use exactly one native platform as the writer.

Preferred writer:

**iOS DEBUG productionPreview**

because its dedicated Guest journey and Preview isolation were directly certified in QRO02B2.

Android may be used as the writer instead only if iOS local tooling is unavailable; record the reason.

The native write must go through the actual production client operation:

`GuestSessionClient.saveRsvp(... GuestRsvpUpdate(message: <marker>))`

or the platform-equivalent ordinary Guest RSVP UI/client path.

Do not call the database directly.

Do not use Prisma to mutate the RSVP.

Do not use an ad-hoc SQL update.

Do not call a Planner/Admin mutation endpoint for the forward mutation.

The request body must contain:
- `originGuestId`;
- `message` marker;

and no other RSVP field unless the platform serializer structurally requires an omitted/null property that is not transmitted.

Explicitly prove that `attending` is absent from the wire body.

## Forward mutation

Perform exactly one test mutation:

`pre-state message -> QRO03 marker`

Expected:
- HTTP 200;
- server returns the full authoritative RSVP record;
- attending remains unchanged;
- party size remains unchanged;
- seating remains unchanged;
- checked-in state remains unchanged;
- invitation style remains `ivory-floral-gold`;
- Guest credential/token digest remains unchanged.

No second forward mutation is permitted.

## Propagation proof

After the forward mutation and before restoration, prove the marker from all required authority views:

1. **authoritative Guest session GET** on the integration Preview;
2. **Planner/Couple desktop authority** using the real Planner account;
3. **native account API / Planner Guest list**;
4. **other native Guest platform**:
   - if iOS wrote, Android must refresh and show/read the marker;
   - if Android wrote, iOS must refresh and show/read the marker.

Prove every view resolves the same:
- weddingId;
- guestId;
- RSVP message marker;
- RSVP status;
- party size;
- seatingTableId.

Do not rely on labels alone.

## Wedding Pass state

Wedding Day is still disabled.

Keep:

`WEWED_PARITY_ALLOW_PASS_GET`

unset.

Do not activate Wedding Day.

Do not issue a Pass.

The coherent state remains:

`BLOCKED-ACTIVATION`

The RSVP message-only edit must not alter this.

## Mandatory restoration

After propagation is proven, restore the exact pre-state through the same ordinary Guest RSVP authority.

If the pre-state message was null/empty, send an explicit empty string so the shared mutation operation restores stored null.

Restoration is authorized as exactly one cleanup write.

After restoration prove:
- message equals the pre-state exactly;
- attending equals pre-state;
- all other RSVP fields equal pre-state;
- party size equal;
- seating equal;
- token digest equal;
- invitation style remains `ivory-floral-gold`;
- checked-in state equal;
- no Pass/Gate state created.

The unit therefore permits:

- **1 controlled test RSVP business-data write**;
- **1 mandatory restoration RSVP write**;
- **0 other wedding business-data writes**.

Do not describe the restoration as another test mutation.

## Remove Preview write authorization

After restoration:

1. remove the branch-scoped `WEWED_PREVIEW_WRITABLE_WEDDING_ID` authorization from the integration Preview;
2. redeploy or otherwise ensure the branch Preview no longer carries the writable-wedding value;
3. prove the current integration Preview is READY;
4. prove a safe RSVP write probe is again refused with:
   `423 PREVIEW_WRITE_BLOCKED`.

Do not leave the live-database Preview writable after QRO03.

## Production safety

The native DEBUG qualification must target the exact integration Preview.

During the write/observation/restoration window, verify production receives zero:
- Guest RSVP PUTs;
- Guest invitation exchange requests from the qualification devices;
- native qualification requests.

If qualification traffic hits production, STOP and classify:

`FALSE / STALE`.

## Audit/evidence discipline

Do not delete logs/history to make the write appear absent.

The current shared Guest RSVP mutation operation does not create a dedicated `AuditEvent` row for every guest self-service edit; do not invent one during this qualification.

Preserve evidence through:
- pre-snapshot;
- safe request timing/path/status;
- post-forward snapshot;
- Planner/native propagation snapshots;
- restoration request;
- final snapshot;
- Vercel runtime evidence.

If the product unexpectedly creates an audit/history row, preserve it.

## Tests / source integrity

QRO03 should not require product source changes.

If the live write reveals a product defect, stop and return it to the moderator.

Do not patch tracked product/test source in the same run after a failed live mutation.

## Receipt

Create:

`docs/QRO03_RSVP01_CONTROLLED_REVERSIBLE_LIVE_WRITE_RECEIPT_20260927.md`

Safe-to-commit evidence only.

Include:
- starting/final branch SHA;
- writable Preview deployment ID/URL/SHA;
- writer platform;
- pre-state safe snapshot;
- exact mutated field name;
- marker digest or literal non-secret marker;
- forward request path/status;
- Planner/Couple observation;
- native API observation;
- other-native observation;
- restoration request/status;
- final-state equality;
- Guest token digest before/after;
- exact business-data write count:
  - test writes = 1;
  - restoration writes = 1;
  - other writes = 0;
- Preview write authorization removed;
- final 423 read-only proof;
- production qualification request count;
- secret scan result;
- open items.

## Safety freeze

Do not:
- merge integration to main;
- deploy integration candidate to production;
- mutate invitation style;
- rotate invitation credentials;
- modify other Guests;
- change wedding date;
- issue/revoke Passes;
- enable WW2;
- create Gate check-ins;
- create Coordinator/Usher accounts;
- access Admin credentials;
- publish native apps.

QRO04:

`NOT RELEASED`

until moderator acceptance of QRO03.

## Stop conditions

Stop and return to moderator if:
- integration HEAD moved unexpectedly;
- pre-state no longer matches the certified Guest;
- branch-scoped Preview write configuration cannot be proven limited to Charity & Kudzie;
- native writer cannot send a message-only partial RSVP update;
- request body includes attendance or another unapproved field;
- forward mutation is not visible consistently in all required authority views;
- restoration cannot return exactly to pre-state;
- token digest changes;
- production receives qualification traffic;
- any Pass/Gate write occurs;
- a product defect requires source patching.

## Completion

Success:

`QRO03 CONTROLLED REVERSIBLE CHARITY & KUDZIE RSVP WRITE PROVEN — NATIVE WRITE PROPAGATED TO PLANNER + OTHER NATIVE AND RESTORED EXACTLY — PREVIEW RETURNED READ-ONLY — RETURNING TO MODERATOR FOR QRO04 RELEASE DECISION.`

Failure:

`QRO03 CONTROLLED RSVP WRITE <NOT PROVEN|BLOCKED-ENV|FALSE / STALE> — <exact one-line reason> — RETURNING TO MODERATOR.`
