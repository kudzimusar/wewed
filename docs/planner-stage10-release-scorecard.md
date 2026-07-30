# Planner Stage 10 release scorecard

Date: 2026-07-30
Merged release: `912208449f01e070db2cd229a83d0eaf951761f8`
Tracking: #46 / PR #47

## Decision rule

Human Alpha testing must not begin until the complete GitHub CI chain passes and the merged application is successfully promoted and smoke-tested in production. Source-marker tests alone do not satisfy this gate.

## Executable evidence

| Area | Rating | Evidence |
| --- | --- | --- |
| Real browser CRUD workflows | Green | Desktop Chromium creates, reads, updates, persists after reload, and deletes records across Tasks, Budget, Vendors, Guests, Timeline, and Seating. |
| Excel import/export/rollback round trip | Green | Chromium downloads the real checklist template, writes a genuine XLSX row, previews and executes the import, verifies the planner record, exports XLSX, verifies workbook content, inspects import history, rolls back, and verifies removal. |
| Two-wedding isolation with populated data | Green | A guarded ephemeral PostgreSQL fixture contains two populated fictional weddings. Browser and direct API assertions verify that records from one selected wedding never appear in the other before or after switching and reloading. |
| Mobile, keyboard, printing, and visual behaviour | Green for tested Chromium matrix | Pixel 5 mobile containment, desktop overflow, keyboard activation, dialog escape, accessible control naming, notification close naming, and wedding-scoped print output are executable browser assertions. |
| Real planner daily usage | Green for deterministic Alpha workflow | The browser creates operational data, switches weddings, verifies isolation, returns to the first wedding, reloads, and checks persisted Tasks, Budget, Vendors, Guests, Timeline, and Seating. |
| Production deployment | Promotion in progress | A READY Vercel preview of the corrected application returned HTTP 200 and `ok: true` from `/api/health`, with no runtime errors found for `/api/health` or `/planner`. The final gate is the Git-integrated production deployment from `main`, followed by the same non-destructive checks. |

## Regressions found and corrected

1. Worksheet controls and the visible planner module used independent state. Selecting Budget worksheet tools could leave Overview or another planner module visible. The selector and workspace navigation are now synchronized in both directions.
2. Notification toast close buttons lacked an accessible name. They now expose `Close notification`, protected by a dedicated browser regression test.
3. Production-build cookies required a guarded localhost exception for browser wedding switching. The exception requires explicit E2E mode, GitHub CI, a local PostgreSQL URL, and absence of Vercel; normal production cookies remain secure.
4. Production health ignored the server-only Supabase service-role fallback already supported by session signing. Health now validates the effective server-side signing secret and still requires at least 32 characters.

## Verified CI evidence

- Clean PostgreSQL migrations, migration status, and schema drift checks passed.
- Original parity, planner integrity, Stages 2–10, and retained Phases 2–6 passed.
- The Next.js production build passed.
- Seven executable desktop/mobile Chromium scenarios passed.
- The merge commit contains no file changes beyond the fully tested release head.

## Safety boundary

- Destructive browser fixture resets refuse to run unless `WEWED_E2E_MODE=1`, `CI=true`, the database host is local, and no Vercel runtime is present.
- Test authentication is subject to the same guard and still validates the database user, signed session, active membership, wedding selection, and planner permissions.
- No production or client wedding is seeded, reset, imported, or edited by Stage 10 automation.

## Residual risk

The automated browser matrix currently covers Chromium desktop and a Chromium-based Pixel 5 profile. It does not claim pixel-identical rendering across Safari or Firefox. Production authenticated workflows are not destructively replayed against client data; instead, the exact production build is exercised against the isolated PostgreSQL fixture, followed by non-destructive production health and route smoke checks.

## Release status

The planner application and deterministic Alpha workflow are green. Human Alpha becomes eligible after the `main` production deployment reports READY, `/api/health` returns HTTP 200 with `ok: true`, the protected planner route responds without application-server failure, and production runtime logs show no related errors.