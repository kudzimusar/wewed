# QRO02A / ENV01 — Preview Authentication Enablement + Authenticated Read-Only Live Parity

**Repository:** `kudzimusar/wewed`  
**Product branch:** `integration/phase13-live-account-data-convergence-20260926`  
**Exact starting product SHA:** `9241e37cb11fa0938a2a0c3ec6e738b2d3ccd001`  
**Moderator decision source:** D-070 on `docs/native-pwa-production-convergence-plan-20260922`  
**Moderator record commit:** `5b9911e5116156e1c594d8c3b34f31e9488cea16`

## Moderator disposition

QRO02 tooling / blocker analysis is **ACCEPTED**.

Real Charity & Kudzie authenticated live parity remains **BLOCKED-ENV / NOT PROVEN**.

QRO03 is **NOT RELEASED**.

Do not rediscover project direction. This unit exists only to remove the authorized Preview authentication blockers and then rerun the already-built read-only parity path.

## Mission

Enable the existing integration Preview to support authenticated, read-only QRO02 parity without changing wedding business data, then prove the real Charity & Kudzie Guest/Couple-Planner corridor across:

`desktop/PWA -> native account API -> Guest Session -> iOS productionPreview -> Android productionPreview`

The target proof is equality of the same real authority identifiers and read state, not convincing fixture screens.

## Pre-edit / pre-environment verification

Before any action:

1. Fetch remote state.
2. Prove `origin/integration/phase13-live-account-data-convergence-20260926` is exactly `9241e37cb11fa0938a2a0c3ec6e738b2d3ccd001`.
3. Verify D-070 directly on the documentation branch.
4. Verify the target Vercel project is `wewed` under team `11-11`.
5. Identify the current integration Preview deployment/alias and the exact Git SHA it serves.
6. If the product branch has advanced, STOP and return the new remote SHA to the moderator before changing anything.

## Frozen architecture

Do not change these decisions:

- Candidate production session hardening remains fail-closed. Do **not** restore the Supabase service-role fallback for new Guest/native sessions.
- Release native builds remain fixed to `https://wewed.pro`.
- productionPreview remains DEBUG-only and origin-allowlisted.
- Guest identity remains invitation-bound and separate from User/UserProfile/WeddingMembership.
- Wedding Pass timing remains T-14 opening, +24h issuance closure, +36h expiry ceiling.
- Invitation QR and Wedding Pass QR remain separate trust domains.
- Charity & Kudzie's wedding date must not be changed to force Pass issuance.
- QRO02A is read-only business-data qualification. It does not authorize QRO03 RSVP mutation.

## Required owner / infrastructure inputs

This unit requires authorized access to all of the following. Never print, commit, paste into receipts, or expose their values:

1. A dedicated high-entropy `WEWED_SESSION_SECRET` scoped to the **integration Preview**.
2. A Vercel Protection Bypass for Automation secret for the Preview.
3. The real controlled Guest private invitation URL, label `G`.
4. A Charity & Kudzie Couple account (`CA`) and/or Planner account (`P`) credential set from secure storage.
5. The correct current Preview deployment/branch alias.

Production `WEWED_SESSION_SECRET` provisioning is a separate release prerequisite. Do not mutate production environment variables in this unit.

## Preview environment actions

With owner-authorized Vercel access:

1. Provision `WEWED_SESSION_SECRET` for Preview only.
2. Provision/use the Vercel Protection Bypass for Automation through secure runtime configuration.
3. Confirm `WEWED_PREVIEW_WRITABLE_WEDDING_ID` remains unset for this integration Preview.
4. Do not add WW2/ROOT keys.
5. Do not enable `WEWED_WEDDING_DAY_WW2_ENABLED`.
6. Do not apply Gate/WW2 migrations.
7. If Vercel requires a redeploy for the new Preview environment, redeploy the **same product commit** only and record the resulting deployment ID/URL/SHA.

## Mandatory preflight

Run the existing credential-free preflight against the exact integration Preview.

Expected result after authorized bypass:

- `deploymentProtection: PASSED`;
- native authority route proven to be an application response;
- native signin route proven to be an application response;
- Wedding Day state classified from the application, not from Vercel protection.

If preflight still reports protection, unexpected routing, or a server error, classify and stop before using real credentials.

## Authenticated read-only parity execution

Use the existing parity tooling. Keep `WEWED_PARITY_ALLOW_PASS_GET` **unset** in this unit.

Required sequence:

```bash
export WEWED_PARITY_ORIGIN=<exact allowlisted integration Preview>
export WEWED_PARITY_COMMIT_SHA=<exact serving product SHA>
export WEWED_PARITY_PROTECTION_BYPASS=<secure runtime secret>
export WEWED_PARITY_GUEST_INVITATION=<secure G invitation URL>
export WEWED_PARITY_ACCOUNT_EMAIL=<secure CA/P account>
export WEWED_PARITY_ACCOUNT_PASSWORD=<secure password>
export WEWED_PARITY_ACCOUNT_LABEL=P   # or CA as appropriate

bun scripts/parity/wewed-parity.ts preflight
bun scripts/parity/wewed-parity.ts collect --out run.json --network-log network.json
```

Then capture real iOS and Android `wewed.parity.v1` exports from DEBUG productionPreview builds against the same exact Preview and same real Guest/account context.

Finally:

```bash
bun scripts/parity/wewed-parity.ts check run.json G-ios.json G-android.json \
  --require desktop,native-api,ios,android \
  --same-wedding G,G-VIA-P,P
```

Adjust labels only if the authenticated account is `CA` rather than `P`; preserve semantic equivalence.

## Required live assertions

Prove, using real Charity & Kudzie records:

- same `weddingId` across the compared Guest/account surfaces;
- same real `guestId`;
- same RSVP read-state;
- same server-computed party size;
- same seating-table authority ID;
- same saved invitation style/message digest;
- same account authority/grant relationship for the selected Couple/Planner context;
- no secret-shaped material in parity artifacts;
- iOS and Android are reading the same real Guest/wedding authority as desktop/native API.

Do not claim Pass business-state success in this unit while WW2 remains disabled/unconfigured.

## Data and security boundaries

Forbidden in QRO02A:

- RSVP `PUT`, `PATCH`, or any controlled write;
- Guest edits;
- Gate check-in;
- Pass issue/revoke;
- `WEWED_PARITY_ALLOW_PASS_GET=1`;
- live database migration;
- WW2/ROOT key provisioning;
- WW2 feature activation;
- Charity & Kudzie wedding-date change;
- production deployment;
- production environment mutation;
- native store/TestFlight/Play release;
- printing secrets, cookies, raw invitation tokens, bearer tokens, or raw WW2 credentials.

Authentication/session creation is allowed because it is transport state, not wedding business-data mutation.

## Qualification evidence

Return:

- exact remote branch and final product SHA;
- exact Preview deployment ID, URL/alias, state and serving SHA;
- confirmation that `apps/` and product source were not changed by this environment unit;
- preflight output with no secrets;
- redacted network log;
- parity run/check result;
- iOS and Android build/runtime identifiers used for productionPreview;
- safe digests/IDs required by `wewed.parity.v1`;
- explicit business-data write count;
- any blocker classification.

## Failure classifications

Use only:

- `ACCEPTED`
- `PARTIALLY ACCEPTED`
- `NOT PROVEN`
- `FALSE / STALE`
- `BLOCKED-ENV`
- `BLOCKED-ACTIVATION`

Do not convert an environment-disabled Wedding Pass response into `not_yet_issuable`.

## Receipt

Create:

`docs/QRO02A_ENV01_PREVIEW_AUTHENTICATION_ENABLEMENT_RECEIPT_20260927.md`

The receipt must distinguish:

- environment enablement proven;
- authenticated application reachability proven;
- real Guest/account live parity proven or not proven;
- Pass/WW2 activation still open;
- exact real business-data writes performed.

## Stop conditions

Stop and return to the moderator if:

- the product branch no longer matches the starting SHA before work;
- required credentials/secret inputs are unavailable;
- Preview cannot be made authenticated without weakening product security;
- any step would require production mutation;
- the parity path unexpectedly requires a wedding business-data write;
- local signed-device/native tooling needed for iOS/Android evidence is unavailable;
- real records disagree across clients.

Do not patch product source during an environment-only run unless a new ordinary repository defect is independently reproduced and the moderator explicitly moves the unit into closure implementation.

## Other-agent disposition

QRO03 remains blocked.

QRO04 remains blocked.

Coordinator/Vendor/Admin work remains out of sequence.

## Exact completion line

If successful:

`QRO02A AUTHENTICATED READ-ONLY CHARITY & KUDZIE LIVE PARITY PROVEN — RETURNING TO MODERATOR FOR QRO03 RELEASE DECISION.`

If blocked:

`QRO02A AUTHENTICATED READ-ONLY LIVE PARITY <BLOCKED-ENV|BLOCKED-ACTIVATION|NOT PROVEN> — <one-line reason> — RETURNING TO MODERATOR.`
