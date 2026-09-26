# QRO02A / ENV01 — Preview authentication enablement: receipt (2026-09-27)

**Status: IMPLEMENTATION-AGENT REPORT — NOT A MODERATOR ACCEPTANCE DECISION.**

**Outcome:** Preview authentication **enabled and verified** (session secret provisioned at Preview /
integration-branch scope; Deployment Protection bypass working; application routes reachable).
Authenticated live parity **not executed**: the real Charity & Kudzie Guest invitation (`G`) and
Couple/Planner credentials (`CA`/`P`) were not available through any secure surface →
**BLOCKED-ENV**.

## 1. Repository

| Item | Value |
| --- | --- |
| Branch | `integration/phase13-live-account-data-convergence-20260926` |
| Starting SHA | `9241e37cb11fa0938a2a0c3ec6e738b2d3ccd001` (verified = remote = local; clean tree) |
| Final SHA | this receipt commit (docs only) — reported in the moderator return |
| Product source changed | **No** |
| `apps/` changed | **No** (byte-identical to qualified `b59893e0`) |
| Docs authority | docs branch `19a8ca75`; **D-070** names QRO02A / ENV01 as the next unit |

## 2. Vercel (project `wewed`, `prj_JSSaBHv2CIhJIeHxep6YigJoObFX`, team `11-11`)

| | Before | After |
| --- | --- | --- |
| Deployment | `dpl_VdPdkRk2UStgzPDttk7yEKRy9ZAP` (`wewed-ffecuyyb0-11-11.vercel.app`, git) | `dpl_Dz8Byj5j7te9txSRfsPm38ScBRyn` (`https://wewed-njdxydo4l-11-11.vercel.app`, `vercel redeploy` of the same deployment) |
| State / target | READY / Preview | READY / Preview (`target: null`), `iad1` |
| Serving SHA | `9241e37c…` | `9241e37cb11fa0938a2a0c3ec6e738b2d3ccd001` — **same source**, redeployed only to pick up the new variable |
| Branch alias | `wewed-git-integration-phase13-live-account-data-co-a8988a-11-11.vercel.app` | same alias, now on the redeploy |
| Deployment Protection | Vercel SSO (`all_except_custom_domains`), no bypass supplied → 401/302 | unchanged SSO; **automation bypass PASSED** |

Relationship to qualified source: `b59893e0` (QRO01 product CI) → `98a16095` (QRO02 tooling CI) →
`9241e37c` (receipts / workflow removal only). Pushing this receipt produces a further docs-only
Preview; it inherits the branch-scoped secret.

## 3. Environment (names/scopes only; no value read or printed — `vercel env ls`, project API)

| Variable | State for the integration Preview |
| --- | --- |
| `DATABASE_URL` | PRESENT (unscoped Production + Preview — the live database) |
| `NEXT_PUBLIC_SUPABASE_URL` | PRESENT (Production + Preview) |
| Supabase anon/public key | PRESENT (Production + Preview) |
| `SUPABASE_SERVICE_ROLE_KEY` | PRESENT (Production + Preview) |
| `WEWED_SESSION_SECRET` | was ABSENT → **PRESENT (provisioned: Preview, branch `integration/phase13-live-account-data-convergence-20260926` only, sensitive)**; Production: ABSENT, **unchanged** |
| `WEWED_WEDDING_DAY_WW2_ENABLED` | ABSENT (not provisioned — forbidden here) |
| WW2 signing configuration | ABSENT (not provisioned) |
| ROOT key configuration | ABSENT (not provisioned) |
| `WEWED_PREVIEW_WRITABLE_WEDDING_ID` | WRONG SCOPE for this unit's purposes: exists only for Preview branch `feature/private-invitation-android-delivery-20260912`; **not applied to the integration Preview → read-only** |
| Vercel Protection Bypass for Automation | PRESENT (one existing `automation-bypass` entry, reused; not created, not printed; held only in a mode-600 scratch file for this session) |

Session security unchanged: the hardened fail-closed signer was not weakened; a dedicated secret was
added instead. The secret value was generated and piped directly into the Vercel CLI — it never
appeared in output, files or history.

## 4. Preflight (sanitized; bypass supplied, no credentials)

```json
{ "origin": "https://wewed-njdxydo4l-11-11.vercel.app", "bypassSupplied": true,
  "deploymentProtection": "PASSED", "nativeAuthorityRoute": "LIVE",
  "nativeSigninRoute": "LIVE", "weddingDay": "DISABLED" }
```

| At (UTC) | Request | Status | Classification (from the application) |
| --- | --- | --- | --- |
| 2026-09-26T18:30:16.744Z | `GET /api/native/account/authority` | 401 | refused (app: no session) |
| 2026-09-26T18:30:17.270Z | `GET /api/wedding-day/pass` | 503 | `WEDDING_DAY_DISABLED` |
| 2026-09-26T18:30:17.939Z | `POST /api/native/account/signin` (empty body) | 400 | refused (app: validation) |

Before enablement (QRO02, same code) every request was `401 vercel-deployment-protection`.

## 5. Qualification status

| Surface | Result |
| --- | --- |
| Preview authentication enablement | **ACCEPTED-READY (agent)** — secret present at correct scope, bypass works, app answers |
| Real Guest invitation (`G`) | **BLOCKED-ENV** — not supplied |
| Couple/Planner (`CA`/`P`) | **BLOCKED-ENV** — not supplied |
| Desktop/PWA parity | BLOCKED-ENV |
| Native account API parity | BLOCKED-ENV |
| iOS productionPreview parity | BLOCKED-ENV (tooling available: iOS 27 simulator, ad-hoc-signed DEBUG build path proven in QRO01) |
| Android productionPreview parity | BLOCKED-ENV (tooling available: emulator, `pro.wewed.app.dev`) |
| `wewed.parity.v1` check | not run (no records) |
| Pass / WW2 | **BLOCKED-ACTIVATION** — the application reports `WEDDING_DAY_DISABLED`; keys/flag absent by design; migration state unproven. Not `not_yet_issuable`. |

## 6. Mutation and configuration accounting

- **Wewed wedding business-data writes: 0.** No authenticated request was made.
- Production configuration changed: **none**.
- Preview configuration changed: **one** variable added (`WEWED_SESSION_SECRET`, Preview, integration branch only).
- Deployments: one same-source Preview redeploy.
- Source files changed: this receipt only.

## 7. Remaining input and exact resumption

Supply, outside chat and outside the repository (e.g. a mode-600 file the agent is told to read):
the real Charity & Kudzie Guest's private invitation link (`G`) and one Couple (`CA`) or Planner
(`P`) email/password. Then, unchanged tooling:

```bash
export WEWED_PARITY_ORIGIN=https://wewed-git-integration-phase13-live-account-data-co-a8988a-11-11.vercel.app
export WEWED_PARITY_COMMIT_SHA=<serving SHA>   WEWED_PARITY_PROTECTION_BYPASS=<secure>
export WEWED_PARITY_GUEST_INVITATION=<secure>  WEWED_PARITY_ACCOUNT_EMAIL=<secure>
export WEWED_PARITY_ACCOUNT_PASSWORD=<secure>  WEWED_PARITY_ACCOUNT_LABEL=P   # or CA
bun scripts/parity/wewed-parity.ts preflight
bun scripts/parity/wewed-parity.ts collect --out run.json --network-log network.json
# iOS / Android DEBUG productionPreview exports (label G), then:
bun scripts/parity/wewed-parity.ts check run.json G-ios.json G-android.json \
  --require desktop,native-api,ios,android --same-wedding G,G-VIA-P,P
```

`WEWED_PARITY_ALLOW_PASS_GET` stays unset. QRO03 / QRO04 not released.
