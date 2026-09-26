# QRO02B / CRED01 — Secure Real-Credential Injection + Authenticated Read-Only Charity & Kudzie Parity

## Repository

`kudzimusar/wewed`

Product branch:

`integration/phase13-live-account-data-convergence-20260926`

Expected starting remote HEAD:

`5e7a3162b910258ad1c88e5600543e556ad7ecc2`

Documentation branch:

`docs/native-pwa-production-convergence-plan-20260922`

Moderator decision:

**D-071 — QRO02A / ENV01 Preview authentication enablement moderator review**

Moderator decision commit:

`28ea07ff7482956d3a6b5edbce8c70f1ef4f8515`

Before doing anything, fetch remote state and verify these are still current.

---

## Moderator disposition

QRO02A is **PARTIALLY ACCEPTED**.

Independently proven:

- remote integration branch / receipt-only delta;
- no product or `apps/` change after QRO02;
- same-source Preview redeploy identity;
- credential-free preflight reached Wewed application runtime behind Deployment Protection;
- application returned `401` for native authority without a session, `400` for empty native sign-in, and `503 WEDDING_DAY_DISABLED` for Wedding Day;
- Pass remains **BLOCKED-ACTIVATION**.

Not yet proven:

- real Guest invitation exchange;
- real Couple/Planner session issuance;
- real Charity & Kudzie record equality across desktop/PWA/native-api/iOS/Android;
- live `wewed.parity.v1` PASS.

QRO03 is **NOT RELEASED**.

---

## Exact authorized mission

Use owner-authorized secure credentials to complete the existing authenticated **read-only** Charity & Kudzie parity run.

This task is not an environment redesign, product implementation, RSVP-write task, Pass task, Gate task, migration task or production deployment task.

Required corridor:

`real private Guest invitation G`
+
`real Couple CA or Planner P account`
→
`integration Preview`
→
`desktop/PWA`
→
`native account API`
→
`iOS productionPreview`
→
`Android productionPreview`
→
`wewed.parity.v1 check`

Target outcome:

the same real `weddingId`, `guestId`, RSVP state, party size, seating authority and saved invitation authority across all required clients.

---

## Pre-edit verification

1. Fetch remote state.
2. Confirm remote product branch HEAD is exactly:
   `5e7a3162b910258ad1c88e5600543e556ad7ecc2`.
3. Prove the only change from `9241e37cb11fa0938a2a0c3ec6e738b2d3ccd001` is the QRO02A receipt.
4. Read D-071 directly.
5. Verify the current branch Preview deployment and branch alias.
6. Record exact deployment ID, URL, state and serving SHA.
7. Run credential-free preflight before touching real credentials.

If product source has advanced unexpectedly, stop and return to the moderator.

---

## Frozen rules

Do not change:

- fail-closed `WEWED_SESSION_SECRET` architecture;
- DEBUG-only productionPreview;
- Release origin fixed to `https://wewed.pro`;
- invitation-bound Guest identity;
- T-14 / +24h / +36h Wedding Pass timing;
- Invitation QR != Wedding Pass QR;
- server-authoritative role/grant resolution;
- server-computed party size;
- canonical seating-table authority IDs.

Do not change Charity & Kudzie's wedding date.

Do not enable WW2.

---

## Secure credential acquisition

Required:

1. real Charity & Kudzie private Guest invitation URL — label `G`;
2. one real Charity & Kudzie Couple account — label `CA` — and/or Planner account — label `P`;
3. Preview protection bypass supplied through the already-authorized secure runtime path.

Use credentials only from an explicitly owner-authorized secure source.

Permitted examples:

- an owner-provided local mode-600 file path;
- an existing approved secret store available to the execution environment;
- an explicitly authorized credential handoff mechanism.

Forbidden:

- asking the owner to paste secrets into chat;
- committing credentials;
- writing credentials into repository files;
- echoing or logging passwords, invitation tokens, session cookies, bearer tokens, bypass values or session-secret values;
- searching unrelated user files or accounts in an attempt to discover credentials.

If no authorized secure credential source is available:

return `BLOCKED-ENV`.

Do not fabricate fixture credentials.

---

## Preview safety

Keep the Preview read-only for wedding business data.

Before authenticated execution, confirm the credential-free preflight still reaches application routes.

Required safe state:

- Deployment Protection successfully traversed by the authorized bypass;
- native authority route responds from Wewed;
- native sign-in route responds from Wewed;
- Wedding Day remains `WEDDING_DAY_DISABLED`.

Keep:

`WEWED_PARITY_ALLOW_PASS_GET`

**unset**.

Do not modify Preview environment variables unless a newly discovered environment regression directly blocks this exact run and the change is within the already-authorized Preview-only scope. Any new environment mutation must be reported explicitly.

---

## Authenticated read-only execution

Use secure runtime injection.

Expected server-side sequence:

```bash
export WEWED_PARITY_ORIGIN=<current exact branch Preview>
export WEWED_PARITY_COMMIT_SHA=<exact serving SHA>
export WEWED_PARITY_PROTECTION_BYPASS=<secure>

export WEWED_PARITY_GUEST_INVITATION=<secure real G invitation>
export WEWED_PARITY_ACCOUNT_EMAIL=<secure real CA/P account>
export WEWED_PARITY_ACCOUNT_PASSWORD=<secure password>
export WEWED_PARITY_ACCOUNT_LABEL=P   # or CA

bun scripts/parity/wewed-parity.ts preflight
bun scripts/parity/wewed-parity.ts collect --out run.json --network-log network.json
```

Do not print the environment.

Do not run shell tracing that can reveal secrets.

The collector must perform no wedding business-data writes.

---

## iOS qualification

Use the already-established iOS DEBUG productionPreview path against the same exact Preview.

Capture a real `wewed.parity.v1` export for Guest label `G` and any account-context export required by the existing checker.

Record:

- native source SHA;
- build mode;
- simulator/device identity;
- exact Preview origin;
- export labels;
- safe IDs/digests only.

Do not edit iOS product source during certification.

If the required local iOS tooling is unavailable, classify `BLOCKED-ENV`.

---

## Android qualification

Use the existing Android DEBUG productionPreview path against the same exact Preview.

Capture the equivalent real parity export.

Record:

- native source SHA;
- build variant/package;
- emulator/device identity;
- exact Preview origin;
- export labels;
- safe IDs/digests only.

Do not edit Android product source during certification.

If required Android tooling is unavailable, classify `BLOCKED-ENV`.

---

## Final parity check

For Planner:

```bash
bun scripts/parity/wewed-parity.ts check \
  run.json G-ios.json G-android.json \
  --require desktop,native-api,ios,android \
  --same-wedding G,G-VIA-P,P
```

Use equivalent `CA` labels when the Couple account is the controlled account.

Do not change evidence to force PASS.

A mismatch is a result.

---

## Required assertions

Prove the same real Charity & Kudzie:

- `weddingId`;
- `guestId`;
- RSVP read-state;
- server-computed party size;
- seating-table authority ID;
- invitation style;
- invitation message digest;
- account/wedding grant relationship;
- client context across desktop/native-api/iOS/Android.

No secret-shaped data may appear in evidence.

Do not claim Pass availability as `not_yet_issuable` while Wedding Day is disabled.

---

## Data/security boundaries

Wedding business-data writes authorized:

**0**

Forbidden:

- RSVP PUT/PATCH;
- Guest editing;
- invitation mutation;
- Pass GET with issuance capability;
- Pass issue/revoke;
- Gate scan/check-in;
- live DB migration;
- WW2/ROOT key changes;
- WW2 feature activation;
- wedding-date changes;
- production environment mutation;
- merge to `main`;
- production deployment;
- TestFlight/App Store/Play publication.

Authentication/session creation is allowed.

---

## Qualification evidence

Return:

- exact start and final branch SHA;
- exact current Preview deployment/alias/state/serving SHA;
- sanitized preflight result;
- authenticated collector result;
- redacted network evidence;
- iOS export/build identity;
- Android export/build identity;
- exact parity-check output;
- safe real IDs/digests used for equality;
- explicit count: `Wewed wedding business-data writes: 0`;
- explicit statement of whether product source changed;
- all blockers or mismatches.

---

## Failure classifications

Use:

`ACCEPTED`

`PARTIALLY ACCEPTED`

`NOT PROVEN`

`FALSE / STALE`

`BLOCKED-ENV`

`BLOCKED-ACTIVATION`

Missing secure credentials → `BLOCKED-ENV`.

Credential accepted but records disagree → `NOT PROVEN`.

Wedding Day disabled → `BLOCKED-ACTIVATION`.

Preview serving unexpected code → `FALSE / STALE` or stop for moderator review.

---

## Receipt

Create:

`docs/QRO02B_CRED01_AUTHENTICATED_READ_ONLY_PARITY_RECEIPT_20260927.md`

The receipt must be safe to commit publicly.

It must contain no secrets or raw invitation/session/bearer values.

State independently:

- credential source category, not secret contents;
- Preview preflight result;
- Guest exchange result;
- Couple/Planner session result;
- desktop/native-api result;
- iOS result;
- Android result;
- final parity result;
- write count;
- Pass classification;
- source changes;
- remaining blockers.

---

## Safety freeze

Do not:

- release QRO03 yourself;
- release QRO04;
- start Gate activation;
- begin Coordinator/Vendor/Admin work;
- deploy production;
- mutate production config;
- mutate Charity & Kudzie business data.

---

## Stop conditions

Stop and return to moderator if:

- product branch unexpectedly advances;
- no authorized credential source exists;
- credentials do not correspond to Charity & Kudzie;
- authenticated access requires weakening security;
- any parity step requires a wedding business-data write;
- iOS or Android qualification tooling is unavailable;
- real IDs/states disagree;
- Preview no longer reaches the Wewed application;
- any production mutation becomes necessary.

Do not patch a mismatch during certification unless the moderator explicitly reclassifies it as a closure-implementation unit.

---

## Other-agent disposition

QRO03 remains blocked until the moderator independently accepts QRO02B.

QRO04 remains blocked.

Progressive programme order remains:

`Guest → Couple/Planner → Gate → Coordinator → Vendor → Admin`

You do not select the next task.

---

## Exact completion line

If successful:

`QRO02B AUTHENTICATED READ-ONLY CHARITY & KUDZIE LIVE PARITY PROVEN — 0 WEDDING BUSINESS-DATA WRITES — RETURNING TO MODERATOR FOR QRO03 RELEASE DECISION.`

If blocked:

`QRO02B AUTHENTICATED READ-ONLY LIVE PARITY <BLOCKED-ENV|BLOCKED-ACTIVATION|NOT PROVEN> — <exact one-line reason> — RETURNING TO MODERATOR.`
