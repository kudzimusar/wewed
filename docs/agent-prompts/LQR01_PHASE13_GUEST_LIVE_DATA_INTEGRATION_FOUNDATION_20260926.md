# MODERATOR → LQR 01 — PHASE 13 GUEST LIVE-DATA INTEGRATION FOUNDATION

Repository:

`kudzimusar/wewed`

Authoritative plan:

`docs/WEWED_PHASE13_GUEST_LIVE_DATA_INTEGRATION_PLAN.md`

Plan ID:

`WW-P13-LIVE-DATA-GUEST-CONVERGENCE-2026-09-26-01`

Current production main:

`ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887`

Backend convergence candidate:

`closure/phase13-global-qr-convergence-lqr01-20260926`

Expected SHA:

`926d89a106b2c85cef064933626a39872fa171e9`

Native QR convergence companion:

`closure/phase13-global-qr-convergence-native-lqr01-20260926`

Expected SHA:

`7efd2d7ea62bbb5afee0b4218388a9ee6cbb79f0`

Accepted iOS Guest presentation branch:

`native-mobile/phase13-ios-invitation-pass-closure-nm06-20260926`

Expected SHA:

`a978470a0ff190d162ded4d6d6c6c4dd6c524f70`

## Moderator disposition

`GUEST LIVE-DATA FOUNDATION RELEASED — FIXTURE-ONLY QUALIFICATION IS NO LONGER SUFFICIENT`

Your task is to establish the first single release-candidate corridor that connects real Wewed backend authority, real Charity & Kudzie Guest data, desktop/PWA, iOS and Android.

You are the implementation agent.

You are not the moderator.

You are not the final certification agent.

Return the completed implementation to the moderator before any local simulator/device acceptance.

---

# 1. Exact authorized mission

Build the minimum safe live-data integration foundation required to prove:

`Couple/Planner → real Charity & Kudzie Invitation → real Guest → RSVP → correct Wedding Pass availability state → Couple/Planner`

across:

- backend;
- desktop/PWA;
- iOS;
- Android.

This unit does **not** authorize broad production deployment.

This unit does **not** authorize premature live Wedding Pass issuance outside the canonical 14-day window.

This unit does **not** certify Gate runtime yet.

---

# 2. Required pre-edit verification

Fetch origin first.

Prove all current refs.

At minimum verify:

`main`

expected:

`ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887`

`closure/phase13-global-qr-convergence-lqr01-20260926`

expected:

`926d89a106b2c85cef064933626a39872fa171e9`

`closure/phase13-global-qr-convergence-native-lqr01-20260926`

expected:

`7efd2d7ea62bbb5afee0b4218388a9ee6cbb79f0`

`native-mobile/phase13-ios-invitation-pass-closure-nm06-20260926`

expected:

`a978470a0ff190d162ded4d6d6c6c4dd6c524f70`

If any authoritative ref moved:

do not blindly build on the stale SHA.

Report the drift before mutation.

Also prove whether LQR01-native already contains NM06 before integrating.

---

# 3. Required integration branch

Create:

`integration/phase13-live-account-data-convergence-20260926`

Expected base:

`closure/phase13-global-qr-convergence-lqr01-20260926`

Do not separately merge the older Phase-8 backend if the current backend candidate already contains it.

Reconcile accepted native changes carefully.

Do not import:

- temporary CI workflows;
- local qualification servers;
- Shadow data snapshots as production authority;
- untracked local evidence;
- moderator experimental branches superseded by independent implementation.

After this unit, the integration branch must be the only release candidate used for the Guest live-data corridor.

---

# 4. Frozen owner decisions

## Writable UAT wedding

The only real-data wedding authorized for controlled Preview writes is:

`Charity & Kudzie`

The actual wedding ID must be supplied through environment configuration.

Do not hard-code it into clients.

## Pass policy

Keep:

- T-14d issuance opening;
- +24h issuance closure;
- +36h credential expiry ceiling.

Do not change Charity & Kudzie's date for testing.

Do not issue a premature real venue bearer credential solely to produce a QR screenshot.

## Progressive role order

`Guest → Couple/Planner → Gate → Coordinator → Vendor → Admin`

Do not expand Vendor/Admin work in this unit.

## Release base URL

Release remains permanently bound to:

`https://wewed.pro`

Only DEBUG/qualification may use productionPreview.

---

# 5. Close Preview safety before real-data writes

The Preview deployment may share the live database.

Before allowing the integration Preview to mutate real data, close the known preview-write gaps.

At minimum cover:

## Native Gate check-in

A Preview Gate check-in write must be blocked unless the target wedding equals the explicit writable UAT wedding.

## Pass revocation

Preview pass revocation must be blocked unless the target wedding is explicitly writable.

## GET /api/wedding-day/pass

Treat this as a mutation-capable route because Pass retrieval may create:

- WeddingPassKey;
- WeddingPassCredential.

A GET exemption must not allow Preview to create real credentials for arbitrary live weddings.

Use a mutation guard tied to the authoritative wedding ID.

## Native/domain writes

Audit all current `/api/native/*` mutation routes.

Require the same safety model.

## Browser authentication side effects

Investigate Preview sign-in/wedding switching behavior.

Avoid silently activating pending memberships or changing real-client defaults merely because a tester signed into Preview, unless that behavior is explicitly required and safely scoped.

Add regression tests.

---

# 6. Implement DEBUG-only productionPreview

Create one explicit qualification environment on BOTH iOS and Android.

Suggested semantic name:

`.productionPreview`

It must use production authority paths, not Shadow.

Required clients include:

- ProductionAuthorityClient;
- NativeDomainApiClient;
- GuestSessionClient;
- Wedding Day client;
- Wedding Pass client.

Use ONE configured base URL.

## Allowlist

Qualification origin must:

- be HTTPS except explicit local test host;
- match an approved host pattern/allowlist;
- fail closed when invalid.

Fix any Android Guest origin override that currently accepts arbitrary hosts.

## Release protection

Release builds ignore Preview override inputs and stay on:

`https://wewed.pro`

Add tests proving this.

## No persona authority

ProductionPreview must not support arbitrary persona/role switching.

Real server-issued grants only.

---

# 7. Guest-first real-data corridor

Use one controlled real Charity & Kudzie Guest.

Do not publish private contact details.

Do not fabricate IDs.

Collect the real authoritative fields:

- weddingId;
- guestId;
- Guest display name;
- couple names;
- wedding date;
- venue;
- invitation style;
- invitation message;
- RSVP state;
- party size;
- table;
- meal/dietary information where authorized;
- Wedding Day programme;
- Wedding Pass availability.

Prove the Guest exists as the SAME record across:

- desktop/PWA;
- iOS;
- Android.

Matching text alone is not enough.

---

# 8. Implement parity record + checker

Create:

`wewed.parity.v1`

At minimum support:

`label`
`client`
`baseUrl`
`commitSha`
`accessUserId`
`grantId`
`weddingId`
`coupleId`
`membershipRole`
`permissions[]`
`businessAccountId`
`vendorId`
`serviceEngagementId`
`guestId`
`rsvpStatus`
`tableId`
`passSerial`
`passDigest`
`gateGrantId`
`gateId`
`capabilities[]`

The checker must fail on real authority mismatch.

Do not emit:

- passwords;
- invitation tokens;
- Guest Session cookie values;
- raw WW2 tokens.

Use a digest for Wedding Pass comparison.

---

# 9. Open Invitation vs Wedding Pass

Preserve two different credentials.

## Open Invitation

Purpose:

private Guest invitation / Guest Session bootstrap.

## Wedding Pass

Purpose:

venue admission.

Do not replace Invitation QR with Wedding Pass QR.

Do not make the same QR perform both jobs.

On Couple/Planner Guest surfaces, make the distinction explicit.

Where an active Wedding Pass exists, a deliberate protected action may show the exact canonical Pass.

Normal lists must never expose raw token values.

---

# 10. Correct Pass availability before T-14d

For Charity & Kudzie outside the issuance window, do not show a fake QR.

All clients must converge on an explicit state equivalent to:

`Attending · Wedding Pass not yet issuable`

Do not collapse not-yet-issuable into a generic network error.

Do not bypass the policy in the live client wedding.

The Guest Pass destination may exist before issuance.

The actual bearer credential may not.

---

# 11. Couple/Planner parity

Prove the desktop/PWA Guest record sees the same real Guest and RSVP.

Required distinction:

`Open Invitation`

and:

`Wedding Pass`.

Wedding Pass administrative metadata should be safe:

- credential state;
- pass serial if issued;
- issue sequence;
- issuedAt;
- expiresAt;
- revoked/superseded state;
- table;
- party;
- arrival status.

Credential state and arrival state are separate.

Do not conflate:

`Pass revoked`

with:

`Partially checked in`.

Both may be true and both must remain visible.

---

# 12. Controlled RSVP write readiness

Prepare, but do not execute broad real-client mutation automatically.

The eventual controlled sequence is:

pre-snapshot

→ native Guest RSVP Accept

→ authoritative DB RSVP changes

→ Couple/Planner sees Attending

→ other native platform sees Attending

→ Pass availability changes coherently.

Any write receipt must record:

- before;
- action;
- after;
- restoration;
- audit effects.

Do not delete audit evidence.

No bulk Guest write is authorized.

---

# 13. Coordinator parity foundation

Do not fully test Coordinator yet, but close shared authority gaps that would make the upcoming Coordinator phase impossible.

Investigate the known mismatch:

desktop global account class

vs:

wedding-level `coordinator` membership

vs:

native coordinator workspace grant.

Establish one shared eligibility rule where practical.

Do not create a client-side "become Coordinator" control.

Do not require a fake global role solely for native parity.

Do not auto-activate invited membership merely because Preview login occurred without an explicit intended rule.

If a product-policy decision remains, return it to moderator.

---

# 14. Required tests

At minimum add or execute tests for:

- Preview mutation blocking on non-UAT wedding;
- Preview mutation allow only for configured UAT wedding;
- mutation-capable GET Pass issuance protection;
- Release ignores productionPreview override;
- DEBUG rejects non-allowlisted qualification origins;
- productionPreview uses real production authority clients;
- productionPreview cannot fall back to Shadow;
- same Guest parity schema across desktop/iOS/Android;
- Invitation QR and Wedding Pass remain separate;
- pre-T14 Pass availability has consistent semantic state;
- Planner/Couple Guest record references same Guest ID;
- Coordinator shared eligibility behavior affected by this unit.

Run relevant backend, browser, iOS and Android source/build tests.

Do not weaken existing tests.

---

# 15. Implementation evidence

Return:

- exact integration branch;
- exact final SHA;
- source branches and SHAs reconciled;
- changed files;
- merge/cherry-pick/reconciliation method;
- Preview URL configuration design;
- Preview safety test results;
- iOS tests/build;
- Android tests/build;
- backend tests/build;
- parity contract examples using anonymized labels;
- any real-data read evidence;
- any real-data write evidence;
- confirmation no raw credential was printed.

If real account credentials are unavailable:

leave authenticated live parity execution OPEN.

Do not manufacture evidence.

---

# 16. Failure classifications

**P0**

- wrong Guest/wedding identity;
- unauthorized live-data write;
- credential leakage;
- arbitrary role escalation;
- admission authority bypass.

**P1**

- desktop/native disagree on Guest/wedding/RSVP;
- Preview cannot reach real authority;
- not-yet-issuable Pass becomes fake QR or generic failure;
- release client can be redirected to arbitrary backend.

**P2**

- material operational/admin parity mismatch.

**P3**

- cosmetic only.

**ENV**

- independently proven qualification environment problem.

---

# 17. Safety freeze

Do not:

- merge integration branch to main;
- deploy Wewed production;
- apply production migrations;
- bulk-send invitations;
- mutate non-UAT weddings from Preview;
- rotate/provision production private keys;
- enable live WW2 globally;
- change Charity & Kudzie's wedding date;
- create fake real-client Gate check-ins;
- publish App Store / Play Store builds;
- expose passwords/session cookies/raw tokens;
- start Vendor/Admin implementation;
- declare Phase 13 complete.

---

# 18. Other-agent disposition

## LQR01

`ACTIVE — GUEST LIVE-DATA FOUNDATION IMPLEMENTATION`

## LNM01 / device certification

`PARKED UNTIL MODERATOR ACCEPTS THE INTEGRATION SHA`

## Gate final certification

`NOT RELEASED`

## Coordinator full certification

`NOT RELEASED — FOUNDATION MAY BE PREPARED`

## Vendor

`PARKED`

## Admin

`PARKED`

## Production deployment

`NOT AUTHORIZED`

---

# 19. Required receipt

Return:

1. start state;
2. exact branches/SHAs;
3. integration method;
4. Preview safety changes;
5. productionPreview changes;
6. Guest parity changes;
7. Couple/Planner Invitation/Pass changes;
8. Coordinator foundation changes;
9. tests;
10. CI;
11. real-data reads;
12. real-data writes;
13. restoration evidence;
14. open items;
15. no-merge/no-production confirmation.

No secrets.

No raw WW2 token.

---

# 20. Completion disposition

If implementation is complete:

`LQR 01 GUEST LIVE-DATA INTEGRATION FOUNDATION COMPLETE — RETURNING TO MODERATOR FOR INDEPENDENT REVIEW.`

If blocked:

`LQR 01 GUEST LIVE-DATA INTEGRATION FOUNDATION BLOCKED — RETURNING TO MODERATOR WITH EVIDENCE.`

Do not task LNM01 yourself.

Do not release Gate, Coordinator, Vendor or Admin yourself.
