# QRO03-CLEAN01 — Retire the temporary Charity & Kudzie writable Preview: receipt (2026-09-27)

**Status: IMPLEMENTATION REPORT — NOT A MODERATOR ACCEPTANCE DECISION.** Under D-082 (QRO03 accepted).
The RSVP mutation was not repeated.

**Result: RETIRED.** Exactly one deployment was permanently deleted, with the owner's explicit
authorization. The current integration Preview is read-only. **Wedding business-data writes: 0.
Other deployments deleted: 0.**

## 1. Evidence preserved before deletion (non-secret)

| Field | Value |
| --- | --- |
| Deployment ID | `dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu` |
| Unique URL | `https://wewed-q3hssjdtx-11-11.vercel.app` |
| Target / status | `preview` / Ready |
| Created | 2026-09-27 01:05:26Z (redeploy of `dpl_3pbzmgGW35aB4T2Gc7boxocPzbo1`) |
| Source SHA | `fadc62feaa11acc69a3bf1aa4fdb428255c4f37d` (listed under the `githubCommitSha` filter with `wewed-3ugogxge1` and `wewed-pwc2l9wee`) |
| Build | 43 s, enhanced machine, 8 vCPU |
| Env it was built with | `WEWED_PREVIEW_WRITABLE_WEDDING_ID` = C&K `cmqos70cb0004q6vxe9g9aiu5`, Preview, integration-branch scope (the entry was removed 01:11:30Z) |
| QRO03 runtime facts | Two C&K RSVP `PUT`s returned 200 (01:08:50Z forward, 01:11:08Z restore). One scope-probe `PUT` returned 409. Two body-less native-tasks `POST`s returned 423 (other weddings). The rest were Guest exchange/snapshot reads. The full record is in `docs/QRO03_RSVP01_CONTROLLED_REVERSIBLE_LIVE_WRITE_RECEIPT_20260927.md` (Attempt 3, commit `2e002fca`). |
| Alias check | Before deletion, the integration branch alias resolved to `dpl_DcRHDD5AVtj9hp1JtkHv2UZhRUe2`, not the target. |

## 2. Authorization and action

- The owner explicitly authorized permanent deletion of exactly `dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu` (answered in session: "Yes, delete exactly that ID").
- 2026-09-27 01:49:44Z: `vercel remove wewed-q3hssjdtx-11-11.vercel.app --yes`. It was addressed by the unique deployment URL, never the project name. CLI result: "Found 1 deployment for removal … Removed 1 deployment — wewed-q3hssjdtx-11-11.vercel.app".

## 3. Post-deletion proofs

| # | Requirement | Evidence | Result |
| --- | --- | --- | --- |
| 1 | Deployment ID no longer resolves | `vercel inspect dpl_q6QdpTUsP1BHtSnAhiMheu2YWNVu` → "Can't find the deployment … under the context 11-11" | pass |
| 2 | Unique URL no longer serves the app | `GET https://wewed-q3hssjdtx-11-11.vercel.app/` (with bypass) → **HTTP 404**, `x-vercel-error: DEPLOYMENT_NOT_FOUND` | pass |
| 3 | Integration branch alias resolves to a Ready deployment | `wewed-git-integration-phase13-live-account-data-co-a8988a-11-11.vercel.app` → `dpl_DcRHDD5AVtj9hp1JtkHv2UZhRUe2` (`wewed-5qylagzr5`), Ready, Preview. It was built by the Git integration from `2e002fca` (the QRO03 receipt commit) at 01:14:48Z, **after** the corridor entry was removed at 01:11:30Z. | pass |
| 4 | No integration-branch `WEWED_PREVIEW_WRITABLE_WEDDING_ID` | `vercel env ls preview`: none in any Preview scope | pass |
| 5 | Safe C&K RSVP probe on the current integration Preview → 423 | Real iOS Guest client exchange, then `PUT /api/weddings/charity-and-kudzie/guest-session` `{}` on `wewed-5qylagzr5` → **`423 PREVIEW_WRITE_BLOCKED`**. The C&K Guest state equals the QRO03 pre-state (message null, `pending`, party 1, table `cmqpub1j…`, `ivory-floral-gold`, token sha256 `92277a97…`). | pass |
| 6 | Production untouched | Production `dpl_ApFS83c3F2MtqNFvCQEF8Pdg1UwL` Ready (main `646f0842…`). Its runtime logs from 01:40Z carry only other users' `/api/notifications/count` and cron jobs, with no qualification traffic. No production deploy, env or config change. | pass |
| 7 | Wedding business-data writes = 0 | Only the guard-refused `PUT {}` probe (423) and read-only Guest exchange/snapshot calls were made | **0** |
| 8 | Other deployments deleted = 0 | The CLI removed exactly 1. Spot-checks still Ready: `wewed-3ugogxge1`, `wewed-pwc2l9wee` (read-only `fadc62fe`), `wewed-111ibn2g5` (newest PR202), `wewed-7ndvsxxt7` (first PR202 after the entry), production `dpl_ApFS83c3…`, integration `dpl_DcRHDD5…`. The 313 PR202 deployments were not touched. | **0** |

## 4. Notes

- Pushing this receipt triggers another Git-integration Preview build of the integration branch. With no writable entry configured, it is read-only like `dpl_DcRHDD5…`.
- No Pass, Gate, WW2, RSVP, invitation, Guest, seating, wedding-date, production or store action. Credentials came from the owner's mode-600 file via a literal parser, never printed. The Admin file was not read. `WEWED_PARITY_ALLOW_PASS_GET` unset.

QRO03-CLEAN01 TEMPORARY C&K WRITABLE PREVIEW RETIRED — CURRENT INTEGRATION PREVIEW READ-ONLY — 0 BUSINESS-DATA WRITES — RETURNING TO MODERATOR FOR QRO04 RELEASE.
