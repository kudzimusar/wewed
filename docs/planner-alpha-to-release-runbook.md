# Wewed Planner Alpha-to-Release Runbook

## Release owner and evidence

Assign one release owner and record the candidate commit, deployment URL, database target, migration status, CI run, and rollback decision point. Do not promote a build that lacks a passing clean-migration run, zero-gap planner parity, retained Stage and Phase suites, and a production build.

## 1. Environment and health

1. Confirm `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WEWED_SESSION_SECRET`, and `NEXT_PUBLIC_SITE_URL` are configured.
2. Use a session secret of at least 32 characters.
3. In production, require HTTPS and reject localhost site URLs.
4. Set `PRODUCTION_SITE_URL` when release policy requires an exact production origin.
5. Call `/api/health`; database, Supabase Auth, site URL, production-origin policy, and required environment checks must pass.
6. Confirm the health response contains no secret values.

## 2. Migration and rollback safety

1. Back up the production database before migration deployment.
2. Run Prisma validation, client generation, clean migration deployment, migration status, and schema drift detection.
3. This Stage 9 release is schema-neutral; an unexpected migration is a release blocker.
4. Keep the prior application deployment available for immediate rollback.
5. Application rollback must not reverse user data automatically. Use import rollback only for the specific selected-wedding import job and persisted rollback token.

## 3. Authentication and permission matrix

Test at least one account for each active role:

- Owner/admin: all planner actions, member management, canon seal/reopen.
- Planner: operational editing, imports, exports, intelligence task creation, closeout when blockers clear; no canon authority unless wildcard permissions are explicitly granted.
- Coordinator: permitted operational edits and exports only.
- Viewer: read and export only; no import, edit, closeout, task creation, or canon controls.

For every role, switch between two accessible weddings and confirm records, dialogs, recommendations, histories, and actions never cross wedding boundaries.

## 4. Core planner smoke test

For a non-production test wedding with representative real data:

1. Create, edit, filter, and delete a Task.
2. Create a Budget item; update actual and paid values; verify category totals.
3. Create and edit a Vendor; verify normalized and pipeline fields remain intact.
4. Create a Guest; assign and unassign a table; verify RSVP details.
5. Create, edit, reorder, print, and delete a Timeline item.
6. Create, resize, rename, and delete a Seating table; confirm delete unassigns guests transactionally.
7. Download, preview, execute, export, inspect history, and roll back one worksheet import.

## 5. Retained tool smoke test

Use the unified daily navigation:

- Team Hub: open assignments, approvals, documents, discussion, and notifications.
- Client profile: save a reversible venue detail and verify the public-site update event.
- Daily Ops: load overview, reminders, templates, auto-seating preview, and imports.
- RSVP Links: repair/export invitation links in the test wedding only.
- Wedding Day: update a test check-in, timeline status, and issue; restore the original state.

## 6. Planner intelligence validation

1. Open Intelligence and verify every recommendation names its module, severity, reason, and saved-record evidence.
2. Confirm the UI states that no client data is sent to an external AI provider.
3. Create a task from one active recommendation and verify:
   - the task belongs to the selected wedding;
   - the recommendation marker and evidence are saved in the task description;
   - a wedding-scoped audit event is recorded;
   - repeating the action does not create a duplicate open task.
4. Clear or change the underlying evidence and confirm the recommendation is revalidated before any new task action.

## 7. Release and data-quality checks

Resolve every blocking Release check:

- required client and venue profile fields;
- at least one active owner membership;
- no failed or rollback-failed imports;
- no failed reminders;
- no open critical/high wedding-day issues;
- no over-capacity tables;
- an explicit valid privacy mode.

A green wedding-data score does not override a failed `/api/health` result.

## 8. Post-wedding closeout

Closeout is intentionally unavailable until the wedding date has passed. Before transition:

- close all planner tasks;
- reconcile outstanding budget and overdue payments;
- close vendor contract/payment obligations;
- resolve event-day issues;
- complete every run-sheet item;
- resolve failed imports and reminders;
- review pending guest content/submissions.

Type the wedding title exactly to transition lifecycle to `after`. Verify the audit event. Closeout never deletes operational records.

Only an owner/admin may seal the canon. Seal only after closeout is ready and lifecycle is `after`. Verify `canonSealedAt` and the audit event. Reopen only under an approved correction process and record the reason in the release incident log.

## 9. Privacy and export review

1. Verify the selected wedding’s privacy mode is intentional.
2. Inspect planner exports for wedding scope and expected fields.
3. Confirm no secrets, session data, internal rollback snapshots, or another wedding’s records appear.
4. Confirm public website routes expose only approved content for the chosen lifecycle/privacy state.

## 10. Incident response

If a release check fails or a tester reports data risk:

1. Stop further imports and mutable testing.
2. Record deployment commit, active wedding, user role, action, timestamp, and affected record IDs.
3. Preserve audit events and import history.
4. Roll back the application deployment when the defect is code-only.
5. Use the specific import rollback token when the defect came from an import.
6. Reopen the canon only when an owner/admin-approved correction requires it.
7. Restore from the database backup only after identifying the exact blast radius and preserving evidence.
8. Re-run the complete CI and smoke-test chain before resuming.

## Release decision

Promote only when CI, `/api/health`, wedding release checks, role tests, cross-wedding isolation, smoke tests, and rollback evidence are all green. Record the final decision and release owner in the deployment log.
