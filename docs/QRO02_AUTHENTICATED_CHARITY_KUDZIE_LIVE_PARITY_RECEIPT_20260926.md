# QRO 02 — Authenticated read-only Charity & Kudzie live parity: receipt (2026-09-26/27)

**Status: IMPLEMENTATION-AGENT SUBMISSION — NOT A MODERATOR VERDICT.**

**Disposition: `QRO 02 AUTHENTICATED LIVE PARITY BLOCKED-ENV — SOURCE FOUNDATION READY / AUTHORIZED LIVE ACCESS UNAVAILABLE — RETURNING TO MODERATOR.`**

No real credential, invitation or Preview authorization was available to this agent, so no
authenticated request was made and no live parity is claimed. Beyond credentials, a **Preview
configuration prerequisite** was found that would block Guest and native-account parity even with
credentials (§4).

```text
Plan ID:  WW-P13-LIVE-DATA-GUEST-CONVERGENCE-2026-09-26-01   Checkpoints: D-068, D-069 (unchanged)
Branch:   integration/phase13-live-account-data-convergence-20260926
Start:    d98c3db72271ac9b298c2fd72fd5d4586b2d02f2 (verified = remote; = qualified b59893e0 + workflow removal + QRO01 receipt)
Final:    reported in the moderator return (this receipt + removal of the temporary QRO02 workflow)
```

## 1. Start state

- Remote integration HEAD was exactly `d98c3db7…` before any work. No newer QRO commit existed.
- Docs branch had advanced to `c4419c48` with **D-069** (moderator acceptance of QRO01, releasing
  this read-only gate). Nothing supersedes QRO 02.

## 2. Preview deployment identity (read-only: GitHub deployments API + Vercel deployment record)

| Field | Value |
| --- | --- |
| Deployment | `dpl_D5gmpEmH6rnbafTtd93e5VdUJK5a` (project `wewed`, team `11-11`) |
| URL | `https://wewed-axd097426-11-11.vercel.app` |
| Branch alias | `https://wewed-git-integration-phase13-live-account-data-co-a8988a-11-11.vercel.app` |
| Serving SHA | `d98c3db72271ac9b298c2fd72fd5d4586b2d02f2` (product-identical to qualified `b59893e0`) |
| Branch | `integration/phase13-live-account-data-convergence-20260926` |
| State | `READY`, target Preview (not production), region `iad1` |
| Earlier | `https://wewed-bedqbzju1-11-11.vercel.app` serves `b59893e0` (also READY) |

Both URLs and the branch alias pass the compiled productionPreview allowlist. Pushing this receipt
produces further Preview deployments of product-identical source.

## 3. Preview environment preflight (presence only; no value read or printed)

Read from the Vercel project's environment listing (`decrypt=false`, values discarded by the parser).

| Configuration | Preview (integration branch) | Note |
| --- | --- | --- |
| Database (`DATABASE_URL`) | PRESENT — **shared `preview,production` target** | Preview reads the live database |
| Supabase URL (`NEXT_PUBLIC_SUPABASE_URL`) | PRESENT | |
| Supabase anon/public key | PRESENT | |
| `SUPABASE_SERVICE_ROLE_KEY` | PRESENT | |
| **`WEWED_SESSION_SECRET`** | **ABSENT** (also absent for production) | blocks Guest + native sessions — §4 |
| `WEWED_WEDDING_DAY_WW2_ENABLED` | ABSENT (WW2 disabled) | Pass state → ACTIVATION |
| `WEDDING_DAY_WW2_PRIVATE_KEY_PEM` / `_KEY_ID` | ABSENT | ACTIVATION |
| `WEDDING_DAY_ROOT_PRIVATE_KEY_PEM` / `_KEY_ID` | ABSENT | ACTIVATION |
| Vercel Protection Bypass for Automation | UNPROVEN (none supplied to this agent) | §5 |
| `WEWED_PREVIEW_WRITABLE_WEDDING_ID` | ABSENT for this branch (exists only scoped to `feature/private-invitation-android-delivery-20260912`) | Preview is fully read-only, as QRO 02 §5 requires — no change needed |

## 4. Blocking finding — Preview session-signing configuration (ENV / ACTIVATION, not a code defect)

On Vercel, a Preview runs with `NODE_ENV=production`. The accepted LQR01 hardening
(`src/lib/session-signing-secret.ts`) requires a dedicated `WEWED_SESSION_SECRET` in production and
throws without it:

| Session | Signer | On this Preview |
| --- | --- | --- |
| Desktop dashboard cookie (`app-session.ts`) | `WEWED_SESSION_SECRET` or service-role fallback | works |
| Native account session (`/api/native/account/signin`) | `primarySessionSigningSecret()` | **throws → native-account parity impossible** |
| Guest session / portfolio (invitation exchange) | `primarySessionSigningSecret()` | **throws → Guest (and therefore iOS/Android Guest) parity impossible** |

This is deliberate security design and is **not** weakened here. It needs an owner-provisioned
`WEWED_SESSION_SECRET` **for Preview** (secret provisioning is outside this agent's authority).
**Activation note beyond QRO 02:** `WEWED_SESSION_SECRET` is also absent for **production**, while
production `main` still signs with the service-role fallback — deploying this candidate to production
without first provisioning it would break every native account and Guest session.

## 5. Vercel Deployment Protection (probed read-only, no credential)

`bun scripts/parity/wewed-parity.ts preflight` against `https://wewed-axd097426-11-11.vercel.app`:

| At (UTC) | Client | Request | Status | Classification |
| --- | --- | --- | --- | --- |
| 2026-09-26T17:33:53.200Z | preflight | `GET /api/native/account/authority` | 401 | vercel-deployment-protection |
| 2026-09-26T17:33:53.236Z | preflight | `GET /api/wedding-day/pass` | 401 | vercel-deployment-protection |
| 2026-09-26T17:33:53.267Z | preflight | `POST /api/native/account/signin` (empty body) | 401 | vercel-deployment-protection |

Result: `PROTECTED_NO_BYPASS`; route liveness and Wedding Day state behind it are `UNPROVEN`. No
attempt was made to work around protection.

## 6. Pre-execution mutation audit (§10) — source, exact SHA `d98c3db7`

| Path the parity run would use | Business-data writes |
| --- | --- |
| `GET /api/weddings/[slug]/guest-session/exchange` | none (lookup + signed cookies) |
| `POST /api/weddings/[slug]/guest-session` (invitation exchange) | none (lookup + signed cookies) |
| `GET /api/weddings/[slug]/guest-session` | none |
| `GET /api/wedding-day/guest` | none |
| `GET /api/wedding-day/pass` | none possible here: WW2 disabled → 503 before any logic; were it enabled, no writable wedding is configured for this branch, so the issuance backstop refuses; Charity & Kudzie is outside T-14 regardless |
| `PUT /api/weddings/[slug]/guest-session` | **RSVP write — never called by QRO 02 tooling** |
| Desktop `/api/auth/signin`, `/me`, `/wedding` on Preview | account bookkeeping suppressed; no invitation acceptance (no writable wedding) |
| `/api/native/account/*`, `/api/native/wedding/*` reads | none |

`guest-session/exchange` has **no persistent business-data side effect**; no fix was required.

## 7. Live database (§6, §30)

The only Supabase connector available in this session exposes an unrelated, inactive project
(`church-os-dev`); the Wewed database is not reachable through an authorized surface here. A
`DATABASE_URL` exists in a local `.env` but was not supplied for this task and was **not used**.
Migration/schema state (`WeddingGate*`, `WeddingPass*`, `WeddingCheckIn`) is therefore **UNPROVEN**;
nothing was applied.

## 8. Source changes (tooling only) and qualification

- `wewed-parity.ts preflight` (credential-free readiness probe) and `collect --network-log`
  (redacted §29 network evidence: timestamp, client, method, path with all query values replaced,
  status, classification — never headers, cookies, bodies or tokens).
- `src/lib/parity/network-evidence.ts`: **defect found against the real Preview and fixed** — Vercel
  protection answers API-style requests with `401` JSON (`Protected deployment`), not only a `302`;
  the first preflight misreported this as "route LIVE / Wedding Day ENABLED". It is now classified
  as protection and everything behind it is `UNPROVEN`. Regression test added.
- No product route imports these modules; `apps/` is byte-identical to qualified `b59893e0`, so the
  QRO01 iOS/Android qualification stands for the native tree.
- Qualification: temporary workflow `QRO02 temporary tooling qualification`, run **`36259520644`**,
  job **`108452543528`** (server suites incl. parity/network-evidence, CI PostgreSQL) — **success,
  274 pass / 0 fail**, at `98a16095dedc792da704713797e0d4e8ab070b4a`. Workflow removed before return.

## 9. Live parity acceptance matrix

| Surface | Authenticated | weddingId | guestId | RSVP | Table | Party | Invitation authority | Pass state | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Desktop Couple/Planner | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | N/A | BLOCKED-ENV |
| Native account API | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | N/A | BLOCKED-ENV |
| Guest Session / PWA | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV |
| iOS productionPreview | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV |
| Android productionPreview | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV | BLOCKED-ENV |

## 10. Explicit live claims

| Claim | Result |
| --- | --- |
| Real Charity & Kudzie connection | **BLOCKED-ENV** |
| Real desktop ↔ iOS ↔ Android Guest equality | **BLOCKED-ENV** |
| Real RSVP read-state parity | **BLOCKED-ENV** |
| Real Charity & Kudzie Pass availability state | **BLOCKED-ACTIVATION** (WW2 flag + WW2/ROOT keys absent for Preview; migration state unproven) |
| Open Invitation authority parity | **NOT PROVEN** (no authenticated access) |
| Wedding Pass QR equality | **N/A — NO ACTIVE CREDENTIAL AUTHORIZED OUTSIDE T-14** |

## 11. Real-data activity

- **Wewed business-data writes performed: 0.**
- Authenticated requests: 0. Real account, Guest or invitation data read: none.
- Unauthenticated requests to the Preview: 3 (table §5), all stopped by Deployment Protection.
- Read-only metadata: GitHub deployment records; Vercel deployment record; Vercel environment-variable
  names/targets (no values).

## 12. Security

No password, invitation token, Guest Session cookie, Supabase or native session token, raw WW2
credential, signing key or bypass secret was read, printed, committed or written to evidence.

## 13. External prerequisites to execute QRO 02 (owner / Vercel)

1. **`WEWED_SESSION_SECRET` for the Preview environment** (and, before any production deployment of
   this candidate, for production). Without it Guest and native-account sessions cannot be issued on
   the Preview.
2. A **Vercel Protection Bypass for Automation** secret for project `wewed`, supplied through secure
   runtime configuration (`WEWED_PARITY_PROTECTION_BYPASS`; iOS `WEWED_PREVIEW_PROTECTION_BYPASS`;
   Android extra `wewed_preview_protection_bypass`).
3. Controlled credentials in secure storage: the real Guest's private invitation link (label `G`) and
   a Couple (`CA`) and/or Planner (`P`) account with Charity & Kudzie membership.
4. For Pass-state parity only (can follow Guest parity): Preview-only
   `WEWED_WEDDING_DAY_WW2_ENABLED` + WW2 and ROOT keys, and an owner decision on the Gate/WW2
   migrations against the live database (state currently unproven).
5. Read-only access to the Wewed database through an authorized surface, for §30 corroboration.

Keep `WEWED_PREVIEW_WRITABLE_WEDDING_ID` unset for this branch during QRO 02.

**Execution once 1–3 exist** (all read-only):

```bash
export WEWED_PARITY_ORIGIN=https://wewed-git-integration-phase13-live-account-data-co-a8988a-11-11.vercel.app
bun scripts/parity/wewed-parity.ts preflight          # expect deploymentProtection: PASSED
bun scripts/parity/wewed-parity.ts collect --out run.json --network-log network.json
# iOS (ad-hoc signed DEBUG): WEWED_NATIVE_ENV=production_preview WEWED_PREVIEW_ORIGIN=… WEWED_PARITY_EXPORT_LABEL=G …
# Android (DEBUG, pro.wewed.app.dev): --es wewed_native_env production_preview --es wewed_parity_export_label G …
bun scripts/parity/wewed-parity.ts check run.json G-ios.json G-android.json \
  --require desktop,native-api,ios,android --same-wedding G,G-VIA-P,P
```

Omit `WEWED_PARITY_ALLOW_PASS_GET` unless WW2 is enabled for the Preview: outside T-14 the read
cannot issue, but it proves nothing while the feature is disabled.

## 14. Open (unchanged, not in scope)

`OPEN — NEXT COUPLE/PLANNER PASS ADMIN UNIT` (no native Planner Pass administration screen).
Coordinator decisions D-COORD-ACCOUNT-CLASS, D-COORD-INVITATION-LIFECYCLE, D-VIEWER-WORKSPACE —
untouched. QRO03 / QRO04 not released.
