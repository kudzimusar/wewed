# WEWED — PHASE 13 GUEST LIVE-DATA INTEGRATION PLAN

Plan ID: `WW-P13-LIVE-DATA-GUEST-CONVERGENCE-2026-09-26-01`

Status: **AUTHORITATIVE EXECUTION PLAN — DOCUMENTED / NOT YET IMPLEMENTED**

Owner priority: **Connect the real Wewed system now, beginning with the Guest corridor, before further fixture-led expansion.**

Repository:

`kudzimusar/wewed`

Authoritative documentation branch:

`docs/native-pwa-production-convergence-plan-20260922`

Documentation baseline before this plan:

`f30b45cb838cd6b8e7082c787aa4dd0afd036087`

Current production main:

`ba4b08f8bca2d5cd5826e1ef1d2701d9049dd887`

Current backend convergence candidate:

`closure/phase13-global-qr-convergence-lqr01-20260926`

Expected SHA:

`926d89a106b2c85cef064933626a39872fa171e9`

Current native QR convergence companion:

`closure/phase13-global-qr-convergence-native-lqr01-20260926`

Expected SHA:

`7efd2d7ea62bbb5afee0b4218388a9ee6cbb79f0`

Current accepted iOS Guest presentation implementation:

`native-mobile/phase13-ios-invitation-pass-closure-nm06-20260926`

Expected SHA:

`a978470a0ff190d162ded4d6d6c6c4dd6c524f70`

---

# Moderator disposition

`PHASE 13 STRATEGY CHANGED — REAL LIVE-DATA CONVERGENCE IS NOW THE PRIMARY QUALIFICATION PATH`

The project must stop treating convincing fixture behavior as sufficient proof of product convergence.

The next release candidate must prove that desktop/PWA, backend/database, iOS and Android are clients of the same real Wewed authority.

The first product corridor is:

`Couple/Planner → Invitation → Guest → RSVP → Wedding Pass state → Couple/Planner → Gate`

The progressive stakeholder order is frozen:

`Guest → Couple/Planner → Gate → Coordinator → Vendor → Admin`

Do not broaden this sequence without moderator approval.

---

# 1. Frozen owner decisions

The following decisions are authoritative for this plan.

## 1.1 Writable real-data UAT wedding

The one writable real-data UAT wedding is:

`Charity & Kudzie`

The wedding ID itself must be supplied through controlled environment configuration.

Do not hard-code the private database ID into client source.

The intended preview control is:

`WEWED_PREVIEW_WRITABLE_WEDDING_ID=<Charity & Kudzie wedding id>`

All other production-backed weddings remain read-only from Preview.

## 1.2 Wedding Pass activation policy

Keep the existing canonical production policy:

- Pass issuance opens 14 days before the wedding;
- issuance closes 24 hours after the wedding;
- credential expiry ceiling remains 36 hours after the wedding.

Do not weaken this production rule merely to simplify qualification.

Charity & Kudzie may be used immediately for:

- real invitation parity;
- Guest identity parity;
- RSVP parity;
- Couple/Planner parity;
- Pass availability-state parity;
- reversible controlled UAT writes.

Do not change the Charity & Kudzie wedding date solely to force Pass issuance.

Do not create a premature real admission credential in the live client wedding merely for testing.

Actual early cryptographic QR/Gate testing must use an isolated qualification mechanism or test dataset that cannot create a prematurely valid production admission credential.

## 1.3 Native Preview connection

Implement a DEBUG/qualification-only production-preview lane.

The intended model is:

`DEBUG qualification app → allowlisted HTTPS Preview origin → production authority code paths → real Wewed database`

Release binaries remain permanently locked to:

`https://wewed.pro`

No Release build may accept an arbitrary backend override.

## 1.4 QR trust domains

These are distinct and must remain distinct:

- **Open Invitation** — private Guest invitation / Guest Session bootstrap;
- **Printed Invitation Access** — shared physical-card invitation access;
- **Wedding Website** — public/share navigation;
- **Wedding Pass** — canonical WW2 venue-admission credential;
- **Vendor / Booking Page** — marketplace/navigation QR.

Do not merge these credentials.

All surfaces displaying the **Wedding Pass** must converge on the same active:

`WeddingPassCredential.token`

for the same Guest.

---

# 2. Core authority rule

Wewed is one system.

The target architecture is:

`one database truth → one permission/business-rule truth → multiple presentation clients`

The acceptable client model is:

- desktop/PWA consumes server authority;
- iOS consumes server authority;
- Android consumes server authority;
- Guest Session remains invitation-bound and separate from account identity;
- Gate authority remains operational and separate from ordinary workspace role selection.

Do not create native-only business truth.

Do not infer role or wedding authority from display labels.

Do not allow a client to choose an arbitrary role.

A person may select only a real server-issued workspace grant, wedding, engagement or Gate assignment.

---

# 3. Known connection state

## 3.1 Production main

Current production `main` contains the real browser/PWA account and Guest invitation/RSVP authority.

It does not contain the complete `/api/native/*` real-account API surface expected by the current native clients.

It also does not contain the complete Phase-13 WW2 Guest Pass / Wedding Day authority.

## 3.2 Backend convergence candidate

The current backend convergence candidate contains:

- native account sign-in;
- production authority resolution;
- native workspace snapshots;
- native wedding domain APIs;
- native vendor domain APIs;
- native Gate APIs;
- Wedding Day Guest APIs;
- WW2 Pass authority;
- QR convergence work.

It is not yet accepted as production.

## 3.3 Native convergence candidate

The current native branches contain:

- production account authority clients;
- production domain API clients;
- production Guest Session client;
- live Guest UI;
- canonical Wedding Pass rendering;
- scanner / offline Gate primitives;
- QR convergence hardening.

The final release qualification must stop testing these pieces against unrelated fixture servers.

---

# 4. Single release-candidate rule

Create one integration release candidate for the live-data programme.

Target branch concept:

`integration/phase13-live-account-data-convergence-20260926`

The integration branch is not created by this documentation task.

Its expected base is the accepted backend convergence candidate because it already contains the earlier Phase-8 native-backend authority work.

Before integration:

1. refresh all remote tips;
2. prove ancestry;
3. do not merge historical Phase-8 backend separately if already contained;
4. verify whether the native QR convergence branch already contains NM06;
5. integrate only accepted native product changes;
6. do not reintroduce temporary qualification workflows;
7. do not import local fixture servers or Shadow data as release authority.

Once the integration branch exists, final Phase-13 Guest qualification must use that branch as the only release-candidate source.

Do not continue final certification against multiple incompatible branch interpretations.

---

# 5. Phase P13-LIVE-1 — Preview safety foundation

Owner data may not be exposed to unsafe Preview mutation.

Before the integration Preview is allowed to use the live database, close all known mutation gaps.

At minimum prove preview protection for:

- native Gate check-in;
- Pass revocation;
- Wedding Pass issuance hidden behind `GET /api/wedding-day/pass`;
- every native task/domain write;
- RSVP mutation;
- planner Pass viewing/issuance paths where applicable;
- Gate assignment/configuration writes.

A GET route that writes is treated as a write for preview safety.

The protection decision must use the authoritative target wedding ID, not a client label.

Required invariant:

`VERCEL_ENV=preview`

and no matching:

`WEWED_PREVIEW_WRITABLE_WEDDING_ID`

→ write is refused.

Only the designated Charity & Kudzie wedding may become writable after explicit Preview configuration.

All other real weddings remain readable but immutable from Preview.

Also review preview browser account behavior so a test login does not silently mutate real account relationships merely by authenticating.

---

# 6. Phase P13-LIVE-2 — DEBUG-only productionPreview

Implement one coherent Preview backend origin.

## iOS

Introduce a DEBUG-only qualification environment that uses:

- `ProductionAuthorityClient`;
- `NativeDomainApiClient`;
- Guest Session production client;
- Wedding Day production client;
- Wedding Pass production client;
- Gate transport where authorized.

## Android

Implement the equivalent productionPreview behavior.

## URL policy

Use one base URL for all real authority clients.

The origin must:

- be HTTPS, except explicitly local test hosts;
- match a compiled/controlled allowlist;
- be rejected if not allowlisted;
- never override Release's `https://wewed.pro` binding.

Shadow personas must remain disabled in productionPreview.

Fixture repositories must not satisfy productionPreview.

A productionPreview build must fail closed rather than fall back to Shadow.

---

# 7. Phase P13-LIVE-3 — Real Guest parity baseline

Guest is the first live-data qualification target.

Use one controlled real Guest belonging to Charity & Kudzie.

Do not publish personal contact details in reports.

Capture the authoritative parity record using stable identifiers and safe values.

At minimum:

- `weddingId`;
- `guestId`;
- Guest display name;
- couple names;
- wedding date;
- venue;
- invitation style;
- invitation message;
- RSVP state;
- party size;
- table assignment;
- meal/dietary data where authorized;
- Wedding Day programme;
- Pass availability state;
- pass serial/digest when an active credential is legitimately available.

The acceptance rule is ID/value parity.

Matching labels alone are insufficient.

---

# 8. Machine-readable parity contract

Create a versioned parity format.

Suggested contract:

`wewed.parity.v1`

Example fields:

`label`

`client = desktop | ios | android`

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

Do not include raw passwords, Guest Session cookies, invitation secrets or raw WW2 bearer tokens.

For the Wedding Pass, print only a digest where evidence requires comparison.

The checker must fail if:

- expected IDs differ;
- an ID is unexpectedly absent;
- labels match but IDs do not;
- permissions differ unexpectedly;
- the same Guest resolves to different wedding authority.

---

# 9. Phase P13-LIVE-4 — Real digital invitation proof

The minimum invitation-send gate is not a visual-only gate.

For the selected Charity & Kudzie Guest prove:

`Couple/Planner private invitation`

→ same invitation identity on desktop

→ same Guest Session identity on iOS

→ same Guest Session identity on Android

→ same wedding

→ same Guest

→ same authored invitation content

→ same RSVP row.

Invitation presentation still must pass the accepted NM06 visual containment requirements.

Real-data qualification must not reintroduce fixture content simply to make screenshots look correct.

---

# 10. Phase P13-LIVE-5 — Controlled RSVP write

After read parity passes, perform one controlled reversible write on the designated UAT Guest.

Before mutation, record a pre-snapshot.

Preferred sequence:

`Pending / current state`

→ Accept RSVP from native

→ authoritative RSVP record changes

→ Couple/Planner desktop reflects Attending

→ other native platform reflects Attending

→ Wedding Pass availability state changes coherently.

If a decline/re-acceptance lifecycle is required for the test:

- record all audit effects;
- do not delete audit history merely to make the database appear untouched;
- revoked credentials remain revoked;
- restore the Guest's intended business state through normal authoritative APIs.

No uncontrolled bulk Guest mutation is authorized.

---

# 11. Wedding Pass state before the 14-day window

For Charity & Kudzie outside the issuance window, the correct state is not a fake QR.

The product must present an explicit coherent state such as:

`Attending · Wedding Pass not yet issuable`

or equivalent approved product copy.

Desktop, iOS and Android must agree semantically.

Do not turn `PASS_ISSUANCE_CLOSED` / not-yet-open into a generic network failure.

Do not issue the real bearer token early solely to make the screen appear complete.

---

# 12. Phase P13-LIVE-6 — Couple/Planner Guest authority

The Couple/Planner Guest record must clearly separate:

## Open Invitation

Private invitation access for that Guest.

## Wedding Pass

Canonical admission authority for that Guest.

When the Pass is not yet issuable, show the real state.

When a Pass is active, a deliberate protected **View Wedding Pass** action may display the exact active credential.

The normal Guest list must never expose raw WW2 tokens.

The administrative surface must expose safe Pass metadata:

- state;
- pass serial;
- issue sequence;
- issued time;
- expiry;
- revocation/supersession state;
- party;
- table;
- arrival/check-in state.

Credential state and arrival state are separate dimensions.

Example:

`Wedding Pass: Revoked`

`Arrival: 1 of 2 checked in`

Do not collapse one into the other.

---

# 13. Wedding Pass equality invariant

For any Guest with an active canonical Wedding Pass:

`PWA Wedding Pass token`

must equal:

`iOS Wedding Pass QR payload`

must equal:

`Android Wedding Pass QR payload`

must equal:

`Couple/Planner View Wedding Pass payload`

must equal:

`Gate scanner expected token`.

This is byte-for-byte equality of the active `WeddingPassCredential.token`.

Evidence should compare a SHA-256 digest, not print the raw bearer token.

Invitation QR is not part of this equality invariant.

---

# 14. Phase P13-LIVE-7 — Gate qualification

Gate follows Guest + Couple/Planner convergence.

Required chain:

`real authorized account`

→ server-issued `gate_operator` operational grant

→ correct wedding

→ correct Gate

→ correct capabilities

→ trusted manifest

→ exact Guest WW2 credential

→ scanner

→ check-in

→ Couple/Planner arrival status.

No fixture Gate assignment may satisfy the release gate.

The production/native Gate runtime must use the device-protected credential store.

Blocked, rejected and retryable offline events must be visible to the operator without exposing the raw token.

Offline authority age must be visible.

The current 12-hour manifest TTL remains unchanged until separately authorized.

---

# 15. Phase P13-LIVE-8 — Coordinator parity closure

Coordinator is the first non-Guest role discrepancy that must be resolved.

Current conceptual mismatch:

- desktop has a flat account-class role axis;
- Coordinator is primarily a wedding-membership role;
- native production authority can express an explicit coordinator workspace grant.

Define one shared eligibility rule.

Target:

an active, authorized Coordinator relationship must resolve consistently on desktop and native.

Do not add a client-side role selector.

Do not auto-upgrade another account class merely to gain Coordinator UI.

Resolve invited-membership behavior explicitly so desktop login is not accidentally required to activate a native Coordinator relationship.

Add a parity contract for:

- `accessUserId`;
- `weddingId`;
- membership role;
- permissions;
- coordinator workspace grant.

---

# 16. Phase P13-LIVE-9 — Vendor and Admin expansion

Only after Guest → Couple/Planner → Gate → Coordinator is stable:

## Vendor

Prove separately:

- Vendor business portfolio;
- Vendor wedding ServiceEngagement;
- multi-wedding engagements where legitimate;
- no fabricated wedding context.

## Admin

Prove:

- platform registry;
- correct system grant;
- native admin overview;
- no wedding-level authority inferred from the global label.

These phases use the same productionPreview and parity contract.

---

# 17. Real account test matrix

Use anonymized labels in evidence.

Recommended minimum:

- `CA` — Couple/Owner on Charity & Kudzie;
- `P` — Planner with legitimate Charity & Kudzie access;
- `C` — Coordinator on Charity & Kudzie;
- `V` — active Vendor business;
- `G` — controlled real Guest on Charity & Kudzie;
- `U` — authorized Gate operator when Gate testing is released;
- `ADM` — Wewed platform administrator where required.

If multiple weddings are available:

- verify Planner multi-wedding context;
- verify account switching;
- verify no wedding-context leakage;
- verify vendor engagement switching.

Credentials must be supplied through secure local/CI secret storage.

Do not commit credentials.

---

# 18. Account and context switching rule

Testing may switch:

- authenticated account;
- server-issued wedding grant;
- planner client/wedding;
- vendor business/engagement;
- Gate assignment.

Testing may not switch an arbitrary role.

No production control may say:

`Choose role = Couple / Planner / Coordinator / Vendor`

unless the listed choices are direct presentation of current server-issued grants.

Switching account means authenticating as another real account.

---

# 19. Required evidence levels

Every claim must be classified.

## SOURCE PROVEN

Code/tests prove the implementation contract.

## LIVE PARITY PROVEN

The same real authority record is observed by desktop, iOS and Android.

## END-TO-END PROVEN

A controlled write performed from one client is observed correctly by the other clients and authoritative backend.

Phase-13 Guest release must not be accepted from SOURCE PROVEN alone.

---

# 20. Invitation-send gate

Before broad Charity & Kudzie digital invitation distribution, prove all five:

1. **Real identity** — invitation opens the intended database Guest.
2. **Real wedding** — desktop/iOS/Android resolve the same `weddingId`.
3. **Real RSVP** — controlled native RSVP is visible in Couple/Planner.
4. **Correct Pass state** — outside the 14-day window the Guest sees the correct not-yet-issuable state, not a fake QR or generic transport error.
5. **Invitation consistency** — Couple/Planner Open Invitation and native Guest invitation resolve to the same private invitation/Guest authority.

This gate does not require premature activation of the real venue bearer QR.

---

# 21. Later QR/Gate certification gate

Before live Wedding Day Gate use, independently prove:

`Guest active WW2 credential X`

= `PWA X`

= `iOS X`

= `Android X`

= `Planner/Couple X`

and:

`Gate accepts X`.

Then revoke/supersede X and prove:

- every active surface stops treating X as valid;
- online Gate rejects X;
- refreshed offline authority rejects X.

Then issue Y and prove convergence on Y.

Do not delete audit history to make the test reversible.

---

# 22. Agent execution sequence

The operating mechanics are frozen.

## Implementation/research agent

Investigates and implements the assigned progressive unit.

Returns exact branch/SHA/tests/evidence.

## Moderator

Independently verifies:

- remote branch tip;
- diff;
- authority boundaries;
- CI/tests;
- screenshots/artifacts;
- claims.

The moderator may patch ordinary gaps discovered **after** the implementation agent returns.

The moderator must not replace the implementation agent by implementing the primary task first.

## Local certification agent

Runs independent simulator/device/browser qualification against the exact moderator-accepted SHA.

Does not patch product source during certification.

If certification finds a defect:

`Local certification → moderator review → implementation/closure → local re-certification`.

---

# 23. Immediate implementation unit

The next implementation unit is:

`LQR01 — Phase 13 Guest Live-Data Integration Foundation`

Its mission is limited to:

1. preview safety closure;
2. single integration candidate;
3. DEBUG-only productionPreview;
4. real Guest parity collector/checker;
5. Charity & Kudzie Guest read parity support;
6. Couple/Planner Open Invitation vs Wedding Pass distinction;
7. correct Pass availability-state convergence;
8. Coordinator eligibility convergence foundation where required by shared authority;
9. qualification automation for those capabilities.

It must not claim full Gate production activation or Phase-13 completion.

---

# 24. Safety freeze

Do not, without explicit owner authorization:

- merge the Phase-13 integration candidate to `main`;
- deploy Wewed production;
- apply production database migrations;
- provision or rotate production WW2 private signing keys;
- provision or rotate production ROOT private signing keys;
- enable the live WW2 feature flag globally;
- publish TestFlight / App Store / Play Store builds;
- bulk-send invitations;
- mass-mutate Charity & Kudzie Guest records;
- change Charity & Kudzie wedding date for testing;
- create fake production Gate check-ins against real Guests;
- delete audit events or credential history;
- expose raw RSVP tokens, Guest Session cookies, invitation secrets or WW2 bearer credentials;
- convert Invitation QR into Wedding Pass QR;
- convert client-side role selection into authority.

---

# 25. Stop conditions

An agent must stop and return control when the next required action needs:

- production credentials unavailable to the agent;
- production migration execution;
- production environment variable mutation;
- destructive real-client data action;
- store signing/release authority;
- an actual product/security decision reserved for the owner.

Ordinary repository defects within the assigned scope should be fixed by the responsible implementation agent.

---

# 26. Required implementation receipts

Every progressive unit must return:

- starting branch;
- starting SHA;
- final branch;
- final SHA;
- changed files;
- data authority affected;
- migrations affected;
- tests executed;
- CI run/job IDs where available;
- screenshots/artifacts where applicable;
- real-data reads performed;
- real-data writes performed;
- rollback/restoration receipt for any controlled write;
- open items;
- production actions explicitly not performed.

No raw credential values may appear in receipts.

---

# 27. Completion dispositions

## Guest integration foundation accepted

`P13 LIVE-DATA FOUNDATION ACCEPTED — REAL CHARITY & KUDZIE GUEST AUTHORITY CONVERGES ACROSS INTEGRATION BACKEND, DESKTOP AND NATIVE / CONTROLLED RSVP PARITY GREEN / PASS WINDOW STATE COHERENT`

## Guest foundation blocked

`P13 LIVE-DATA FOUNDATION BLOCKED — REAL AUTHORITY PARITY OR PREVIEW SAFETY NOT PROVEN`

## Invitation-send gate accepted

`P13 DIGITAL INVITATION SEND GATE ACCEPTED — REAL GUEST IDENTITY, WEDDING, INVITATION AND RSVP PARITY PROVEN`

## Gate QR certification accepted

`P13 WEDDING PASS / GATE CERTIFICATION ACCEPTED — SAME ACTIVE WW2 CREDENTIAL PROVEN ACROSS GUEST, PLANNER/COUPLE AND GATE`

## Phase 13 complete

Do not use a Phase-13-complete disposition until:

- Guest live parity passes;
- invitation-send gate passes;
- Gate credential convergence passes;
- Coordinator parity closes;
- required production activation is independently verified.

---

# 28. Next programme direction

Execute progressively:

`Guest → Couple/Planner → Gate → Coordinator → Vendor → Admin`

The Guest corridor is now the primary release path.

Fixture-based qualification remains useful for deterministic regression testing, but it is no longer sufficient evidence of release convergence.
