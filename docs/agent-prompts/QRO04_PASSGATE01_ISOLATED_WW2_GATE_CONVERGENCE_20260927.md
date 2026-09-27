# QRO04 / PASSGATE01 — Isolated WW2 Wedding Pass + Gate Convergence Qualification

## Repository

`kudzimusar/wewed`

## Authoritative branch

`integration/phase13-live-account-data-convergence-20260926`

Required starting HEAD:

`fa7284fd9b60f927ab28eb6ec627d3ac4a38d4cd`

Current integration Preview:

`dpl_GG31VmHJUcTeYorQy6EPBNmehhAn`

Current integration Preview source:

`fa7284fd9b60f927ab28eb6ec627d3ac4a38d4cd`

Production main:

`646f08421d778cf6f85bf12195581228ae3fbccc`

Moderator decision:

**D-083 — QRO03 cleanup accepted; QRO04 Wedding Pass/Gate qualification released**

## Agent role

You are the QRO04 implementation/qualification agent.

You may investigate and patch ordinary bounded Pass/Gate defects on a dedicated closure branch if qualification exposes them.

Do not patch around product invariants.

Do not touch production.

Return all results to the moderator for independent review.

## Core objective

Certify that Wewed has one canonical Wedding Pass authority:

`Guest authority -> WW2 WeddingPassCredential -> Planner/Couple view -> Gate exact-token verification/check-in`

and that iOS, Android, web/server and Gate agree on the same credential lifecycle.

The global lifecycle to prove is:

`X issued -> X reused everywhere -> X revoked -> X rejected everywhere -> Y freshly issued -> Y accepted everywhere`

Never expose raw X or Y in a committed receipt. Use SHA-256 digests plus safe serial/issueSeq metadata.

# 1. HARD CHARITY & KUDZIE BOUNDARY

Charity & Kudzie is real owner data.

Certified real wedding date:

`2026-12-23`

Current qualification date:

`2026-09-27`

Canonical Pass timing:
- opens = wedding date - 14 days;
- issuance cutoff = wedding date +24h;
- expires = wedding date +36h.

Therefore Charity & Kudzie is **not** the active Pass issuance fixture.

The designated real Guest is also currently RSVP `pending`.

Do not:
- change the C&K wedding date;
- change C&K RSVP to attending;
- issue a C&K Wedding Pass;
- create a C&K WeddingPassKey;
- create a C&K WeddingPassCredential;
- create a C&K WeddingCheckIn;
- create/modify a C&K WeddingGate;
- assign a real C&K Gate operator;
- enable WW2 on production or the shared live-data integration Preview.

If any C&K Pass/Gate row appears as a result of QRO04, STOP immediately and return to the moderator.

# 2. PRE-EDIT VERIFICATION

Before editing or running mutating tests:

1. fetch remote;
2. verify integration HEAD is exactly:
   `fa7284fd9b60f927ab28eb6ec627d3ac4a38d4cd`;
3. verify integration Preview `dpl_GG31VmHJUcTeYorQy6EPBNmehhAn` is READY and serves exact HEAD;
4. verify production main is still `646f08421d778cf6f85bf12195581228ae3fbccc`;
5. verify the QRO03 writable deployment `dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu` is gone;
6. verify current integration Preview remains read-only;
7. inspect the current Wedding Pass/Gate migrations, routes, native models and tests before deciding any source change is necessary.

If integration advanced unexpectedly, STOP and return moderator.

# 3. REAL CHARITY & KUDZIE — READ-ONLY READINESS TRACK

Use only safe read surfaces.

Use the existing real Planner credential source if needed:
`~/.wewed-qa/qro02b.env`

Do not read the Admin credential file.

Do not call Guest Pass GET after turning WW2 on. WW2 must remain disabled on the shared integration Preview.

Prove and record:

- wedding ID and date remain the certified values;
- designated Guest ID remains the certified value;
- RSVP remains `pending`;
- invitation style remains `ivory-floral-gold`;
- Planner/Couple `GET /api/planner/wedding-passes` is read-only;
- it does not select or return bearer token/nonce/signature material;
- opening/listing Pass metadata creates no WeddingPassCredential;
- Wedding Day reports disabled / `BLOCKED-ACTIVATION`;
- no WeddingCheckIn is created;
- no Gate authority is created/modified;
- Guest token digest remains unchanged.

If direct live-row counts are available through an existing safe diagnostic/read path, record counts for:
- WeddingPassKey;
- WeddingPassCredential;
- WeddingCheckIn;
for C&K before/after.

Do not introduce a new production diagnostic endpoint solely for QRO04.

# 4. ISOLATED QUALIFICATION ENVIRONMENT

The active Pass/Gate lifecycle must run only against a disposable local/CI PostgreSQL database.

Use the existing repository qualification architecture:

`.github/workflows/wedding-pass-convergence-ci.yml`

The workflow explicitly uses:
- PostgreSQL 16 service;
- clean migrations;
- disposable database;
- synthetic session secret;
- CI-only / generated P-256 keys;
- no production data;
- no production signing key.

You may reproduce that environment locally if needed.

Never point `AUTHORITY_TEST_DATABASE_URL`, `DATABASE_URL`, or `DIRECT_URL` at Supabase/live/shared Preview for the active lifecycle tests.

Before executing, print/record only a safe database-origin classification:
`localhost/disposable = true`

Never print database passwords beyond the fixed CI-local synthetic value already present in workflow source.

# 5. CRYPTOGRAPHIC KEY BOUNDARY

Generate ephemeral P-256 keys for QRO04.

Required roles:
- WW2 credential signing key;
- Wedding Day root/manifest signing key.

Set only in the disposable test process:
- `WEDDING_DAY_WW2_PRIVATE_KEY_PEM`;
- `WEDDING_DAY_WW2_KEY_ID`;
- `WEDDING_DAY_ROOT_PRIVATE_KEY_PEM`;
- `WEDDING_DAY_ROOT_KEY_ID`;
- `WEWED_WEDDING_DAY_WW2_ENABLED=true`.

Do not copy, inspect, reuse or expose any production key.

Do not commit generated private keys.

Receipt may record only:
- algorithm;
- generated-for-test=true;
- public-key fingerprint/digest if useful;
- key IDs that are obviously synthetic.

# 6. REQUIRED SERVER QUALIFICATION

Run the complete focused Wedding Pass convergence gate at the exact product source.

At minimum:

`bun test src/lib/wedding-pass-availability.test.ts`

`bun test src/lib/wedding-day.integration.test.ts`

`bun test src/lib/wedding-day-routes.integration.test.ts`

`bun test src/lib/wedding-day-activation-rehearsal.integration.test.ts`

`bun test src/lib/global-qr-convergence.integration.test.ts`

`bun test src/lib/preview-live-data-safety.integration.test.ts`

`bun test src/lib/rsvp-pass-lifecycle-writers.integration.test.ts`

Run the corresponding GitHub workflow if available for the branch.

Also run:
- gate-authority boundary tests;
- migration/preflight checks relevant to Gate/WW2;
- server build/typecheck required by the repository.

# 7. REQUIRED WW2 LIFECYCLE PROOF — X -> REVOKE -> Y

Use a synthetic wedding inside the issuance window.

Its date must be naturally inside T-14, e.g. now +3 to +5 days.

Do not alter a real wedding date.

Use a synthetic Guest with:
- attending = true;
- household size >=2 if supported, so partial/full arrival can be proven.

Required sequence:

### X issuance
1. Guest authorized retrieval issues X.
2. X has:
   - tokenVersion `WW2`;
   - six canonical dot-separated segments;
   - issueSeq 1;
   - active credential state.
3. repeated Guest retrieval returns exactly the same X, not a newly minted token.
4. Planner/Couple metadata reports the same serial/issueSeq but leaks no token.
5. authorized Planner/Couple exact-view action returns byte-for-byte X.
6. manifest contains the same credential.
7. Gate cryptographic verification accepts X.

Receipt:
- digest(X);
- safe passSerial;
- issueSeq;
- never raw X.

### X gate admission
Use exact X token.

Prove:
- primary/selected attendee check-in succeeds;
- arrival state changes independently of credential state;
- duplicate/idempotent behavior follows the canonical contract;
- serial-only admission is refused;
- Guest Session token/cookie cannot act as admission authority;
- wrong wedding, tampered signature or unauthorized event is rejected.

### Revoke X
Revoke X through the actual authorized Gate revocation route/domain path.

Prove:
- reason required;
- X row preserved;
- revokedAt and revocationReason set;
- superseded/lifecycle state coherent;
- Planner/Couple reports revoked;
- fresh manifest marks X revoked;
- online Gate rejects X;
- offline queued replay of X is terminally rejected;
- native/web Guest must not continue displaying X as active.

### Y issuance
The next authorized Guest retrieval inside the window must issue Y.

Prove:
- Y != X;
- digest(Y) != digest(X);
- new credential ID;
- new passSerial;
- new nonce;
- issueSeq = 2;
- old X remains preserved as revoked/superseded;
- only one live credential exists.

Then prove:
- Guest returns Y;
- Planner/Couple exact view returns byte-for-byte Y;
- manifest carries Y;
- Gate accepts Y;
- revoked X remains rejected.

# 8. ISSUANCE WINDOW POLICY

Prove unchanged:

- before T-14:
  `not_yet_issuable / PASS_NOT_YET_ISSUABLE`;
- exactly T-14:
  issuance permitted;
- through wedding +24h:
  issuance permitted;
- after +24h:
  `issuance_closed / PASS_ISSUANCE_CLOSED`;
- expiry ceiling:
  wedding +36h;
- issuance time never moves the expiry ceiling.

No date cheating.

# 9. RSVP <-> PASS LIFECYCLE

On synthetic data prove:

- pending RSVP -> no Pass, `rsvp_required`;
- declined RSVP -> no Pass, `declined`;
- message/meal/dietary-only edit does not rotate or revoke an active Pass;
- attending true -> false transactionally invalidates/supersedes active credential;
- false -> true does not silently resurrect old token;
- next authorized retrieval issues fresh credential;
- old credential remains rejected.

# 10. PLANNER/COUPLE PASS ADMINISTRATION

Prove:
- list endpoint is read-only;
- list endpoint cannot mint;
- list endpoint contains no bearer token, nonce or signature;
- credential and arrival are independent dimensions;
- exact-view action requires `guests.edit`;
- viewer-only permission cannot reveal token;
- exact-view action returns stored token, never reissues;
- view audit contains no token material.

# 11. GATE AUTHORITY

Use synthetic/disposable Gate authority only.

Do not create a real account.

Synthetic operator must be an active User with a WeddingGateAssignment where:
- operatorRole = `usher`;
- grant kind = `gate_operator`;
- wedding/gate/operator are resolved from fresh server authority;
- minimum capabilities used:
  - `gate.manifest.read`;
  - `gate.checkin.write`;
  - `gate.pass.revoke`.

Prove:
- no client-supplied weddingId/gateId/operatorUserId can override authority;
- revoked/expired assignment loses access;
- Gate context is no-store;
- no legacy global-admin shortcut grants Gate authority;
- check-in exact token is mandatory;
- serial-only path is rejected;
- offline queue exact-token reconciliation is supported;
- legacy queue entries without exact token are blocked, never admitted.

# 12. NATIVE IOS QUALIFICATION

Run the iOS Wedding Pass/Guest tests at exact source.

At minimum cover:
- active pass keeps token byte-for-byte as QR payload;
- P-256 verification succeeds;
- bad signature fails;
- wrong Guest fails;
- revoked response never yields an active Pass;
- all availability states map correctly;
- RSVP precheck avoids issuing/requesting a Pass when pending/declined;
- Pass tab copy remains distinct from Invitation QR terminology.

If simulator tooling is available, additionally run the relevant Guest Pass identity Maestro flow against an isolated/local synthetic server.

Do not point that active Pass flow at C&K/live Preview.

# 13. NATIVE ANDROID QUALIFICATION

Run Android unit/instrumentation relevant to:
- WW2 parsing/verification;
- exact QR payload;
- availability-state copy;
- revoked/invalid token handling;
- Guest Pass identity.

If emulator tooling is available, run the relevant Guest Pass identity Maestro flow against isolated/local synthetic authority.

Do not point active Pass issuance at C&K/live Preview.

# 14. QR SEPARATION INVARIANT

Explicitly prove:

`Invitation QR != Wedding Pass QR`

Invitation QR remains:
- Open Invitation / private guest bootstrap; or
- Printed Invitation Access; or
- Wedding Website sharing.

Wedding Pass QR must encode exact WW2 credential locally.

It must never:
- encode the RSVP token;
- encode a Guest-session cookie;
- call a generic QR service;
- be relabelled as Invitation QR.

# 15. SOURCE-CHANGE RULE

Start with qualification.

If everything passes, make no product source change.

If a bounded implementation defect is found:
- create `closure/phase13-qro04-pass-gate-<short-defect>-20260927`;
- patch the minimum product/test source;
- rerun the complete relevant qualification;
- return exact diff/SHA.

Do not weaken tests to pass.

If the defect requires:
- production signing keys;
- production WW2 activation;
- destructive live action;
- real Gate operator creation;
- real C&K Pass/Gate mutation;
- architecture/product-security decision;

STOP and return to moderator.

# 16. RECEIPT

Create:

`docs/QRO04_PASSGATE01_ISOLATED_WW2_GATE_CONVERGENCE_RECEIPT_20260927.md`

Include:
- starting SHA;
- final SHA;
- branch;
- C&K read-only evidence and unchanged state;
- disposable DB proof;
- migrations applied;
- test key classification;
- all test commands/results;
- GitHub workflow run if used;
- X digest + safe metadata;
- X reuse proof;
- X Gate acceptance;
- X revocation proof;
- X rejection proof;
- Y digest + safe metadata;
- Y convergence proof;
- T-14/+24h/+36h proof;
- RSVP lifecycle proof;
- Gate authority proof;
- iOS result;
- Android result;
- QR separation proof;
- production/shared-Preview mutation count = 0;
- C&K Pass/Gate business writes = 0;
- raw WW2 tokens in receipt = 0;
- private keys in receipt = 0;
- secret scan.

## Completion

Success:

`QRO04 ISOLATED WW2 WEDDING PASS + GATE CONVERGENCE PROVEN — X/REVOKE/Y + EXACT-TOKEN GATE + IOS/ANDROID CONTRACTS PASS — CHARITY & KUDZIE UNCHANGED — RETURNING TO MODERATOR.`

Failure:

`QRO04 PASS/GATE <NOT PROVEN|BLOCKED-ENV|FALSE / STALE> — <exact one-line reason> — CHARITY & KUDZIE UNCHANGED — RETURNING TO MODERATOR.`

# 17. SAFETY FREEZE

Do not:
- merge integration to main;
- deploy integration to production;
- activate WW2 on production/shared live-data Preview;
- use production/private signing keys;
- change C&K RSVP;
- change C&K wedding date;
- issue/revoke C&K Passes;
- create C&K check-ins;
- create real Gate operators;
- modify live Gates;
- apply new production migrations;
- publish native apps;
- read Admin credentials.

Phase14 remains blocked.

Coordinator/account-class decisions remain later work and must not be mixed into QRO04.
