# Planner Stage 10 release scorecard

Date: 2026-07-30
Release candidate: `recovery/stage-10-executable-regression-gate`
Tracking: #46 / PR #47

## Decision rule

Human Alpha testing must not begin until the exact release candidate passes the complete GitHub CI chain and the merged commit is successfully promoted and smoke-tested in production. Source-marker tests alone do not satisfy this gate.

## Executable evidence

| Area | Rating | Evidence |
| --- | --- | --- |
| Real browser CRUD workflows | Green | Desktop Chromium creates, reads, updates, persists after reload, and deletes records across Tasks, Budget, Vendors, Guests, Timeline, and Seating. |
| Excel import/export/rollback round trip | Green | Chromium downloads the real checklist template, writes a genuine XLSX row, previews and executes the import, verifies the planner record, exports XLSX, verifies workbook content, inspects import history, rolls back, and verifies removal. |
| Two-wedding isolation with populated data | Green | A guarded ephemeral PostgreSQL fixture contains two populated fictional weddings. Browser and direct API assertions verify that records from one selected wedding never appear in the other before or after switching and reloading. |
| Mobile, keyboard, printing, and visual behaviour | Green for tested Chromium matrix | Pixel 5 mobile containment, desktop overflow, keyboard activation, dialog escape, accessible control naming, notification close naming, and wedding-scoped print output are executable browser assertions. |
| Real planner daily usage | Green for deterministic Alpha workflow | The browser creates operational data, switches weddings, verifies isolation, returns to the first wedding, reloads, and checks persisted Tasks, Budget, Vendors, Guests, Timeline, and Seating. |
| Production deployment | Release-blocking until post-merge promotion | The exact merged commit must be deployed, `/api/health` must report ready, the public planner route must load without server errors, and the CI-only identity path must remain inactive on Vercel. Evidence is recorded on #46. |

## Regressions found and corrected

1. Worksheet controls and the visible planner module used independent state. Selecting Budget worksheet tools could leave the Overview or another planner module visible. The selector and workspace navigation are now synchronized in both directions.
2. Notification toast close buttons lacked an accessible name. They now expose `Close notification`, protected by a dedicated browser regression test.
3. Production-build cookies required a guarded localhost exception for browser wedding switching. The exception requires explicit E2E mode, GitHub CI, a local PostgreSQL URL, and absence of Vercel; normal production cookies remain secure.

## Safety boundary

- Destructive browser fixture resets refuse to run unless `WEWED_E2E_MODE=1`, `CI=true`, the database host is local, and no Vercel runtime is present.
- Test authentication is subject to the same guard and still validates the database user, signed session, active membership, wedding selection, and planner permissions.
- No production or client wedding is seeded, reset, imported, or edited by Stage 10 automation.

## Residual risk

The automated browser matrix currently covers Chromium desktop and a Chromium-based Pixel 5 profile. It does not claim pixel-identical rendering across Safari or Firefox. Production authenticated workflows are not destructively replayed against client data; instead, the exact production build is exercised against the isolated PostgreSQL fixture, followed by non-destructive production health and route smoke checks.

## Release status

The candidate is eligible to merge only after the full CI chain is green. Human Alpha is eligible only after the exact merge commit passes production promotion and smoke validation.
