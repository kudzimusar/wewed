# Planner Worksheet UX & Operations — Production Closeout

## Closeout stamp

- **Closeout stamp ID:** `WW-PLANNER-UX-2026-08-17-01-CLOSEOUT`
- **Parent plan stamp:** `WW-PLANNER-UX-2026-08-17-01`
- **Status:** **STAMPED — PRODUCTION VERIFIED**
- **Issued:** 2026-08-17
- **Authoritative plan:** `docs/PLANNER_WORKSHEET_UX_OPERATIONS_PLAN.md`
- **Implementation PR:** `#136` — Planner worksheet UX: contrast, A4 print, arrange, bulk actions and secure team QR
- **Exact qualified PR head:** `66e785fad24f523a38f5c22565b8e4de87c1fa13`
- **Production merge/main commit:** `f45486cba0780dbb05be28a49c2ae37bacafba57`
- **Production Vercel deployment:** `dpl_72eAR9Dsso2FfCeUUYgdKQUoe2X5`
- **Production deployment URL:** `wewed-m9rtambwp-11-11.vercel.app`
- **Production aliases:** `wewed.pro`, `www.wewed.pro`
- **Production READY:** 2026-08-17 08:29:41.069 UTC / 2026-08-17 17:29:41.069 +09:00

This document closes the implementation governed by the parent stamped plan. Future changes to these Planner contracts must preserve the safety invariants and regression gates recorded here or supersede them with a later stamped plan.

---

## Production result

The stamped Planner Worksheet UX & Operations implementation is merged and live in Production.

The release delivered the following controlled capabilities:

1. **Fixed-dark Planner form readability** independent of the device/browser light or dark preference.
2. **One A4 Print / Save PDF system** covering Overview, Tasks, Budget, Vendors, Guests, Timeline and Seating.
3. **Durable worksheet presentation ordering** with drag, keyboard and explicit Top / Up / Down / Bottom controls.
4. **Multi-select worksheet operations** using current-view selection and consequence-aware bulk actions.
5. **Secure QR/link project-team invitations** with explicit signed-in acceptance, expiry, revoke/rotate and wedding-scoped authority.
6. **Regression and browser gates** that exercise the new interaction contracts against an isolated PostgreSQL test database.

No Prisma schema migration was introduced by this release.

---

# Release qualification evidence

## Exact-head preview

The exact qualified PR head `66e785fad24f523a38f5c22565b8e4de87c1fa13` produced Vercel Preview deployment:

- deployment: `dpl_GM6b2nTgJU7Sh6rKJbNTgdvd4gHB`
- state: **READY**

The exact head was not merged until the full release matrix and preview gate were green.

## Exact-head GitHub release matrix

The following workflows completed successfully for the exact PR head before merge:

- `CI` — run `32010046536`
- `Planner Worksheet UX` — run `32010046511`
- Preview Data Safety
- Admin and Couple Consistency
- Production Integration Hardening CI
- Planner Relationship Intelligence CI
- Provider Security CI
- Admin Console CI
- Budget Data Integrity
- Database Integrity CI
- Provider Forms CI
- AI Wedding Architect CI
- Admin Command Centre CI
- AI Workspace CI
- Planner Marketplace CI
- Session Closeout Admin Productivity CI

The general CI job completed its full sequence successfully, including:

- Prisma schema validation and client generation;
- migration deployment/status/diff against a clean PostgreSQL database;
- Planner Stage 2 through Stage 10 contracts;
- Planner Phase 2 through Phase 6 contracts;
- planner production-blocker and worksheet round-trip tests;
- application build;
- Chromium installation;
- the executable Planner browser release gate.

The browser failure artifact step was skipped because the browser gate succeeded.

---

# Executable browser verification

The release includes `tests/e2e/planner-worksheet-ux.spec.ts`. The exact qualified head passed the executable Chromium gate against the existing ephemeral CI PostgreSQL fixture.

The browser verification proves representative end-to-end behavior for:

### Theme / form readability

- Budget inputs are exercised under forced **light-system** and **dark-system** browser themes.
- Entered values remain visible on the fixed-dark Planner surface.
- The Planner field foreground contract remains champagne and the scoped color scheme remains dark.

### A4 Print / Save PDF and ordering

- The Tasks worksheet opens the shared Print / Save PDF flow.
- The generated document uses the canonical A4 print contract and repeating table-header rules.
- A second synthetic task is created in the isolated test database.
- Presentation order is changed and saved through the governed order API.
- The order round-trips correctly while the task records themselves remain present and unchanged.

### Multi-select safety

- Tasks expose controlled multi-select actions such as status and priority changes.
- Budget exposes safe actions such as category, due date and vendor linking.
- Generic bulk overwrite of `paidAmount` and `actualCost` is explicitly absent.

### Secure QR/link team invitation

- A synthetic owner and invitee are created only inside the ephemeral browser-test database.
- A Planner invitation is created and accepted by a different account.
- The invitee receives the correct active wedding and Planner membership.
- Replaying the consumed invitation fails closed with HTTP 410.
- A wedding/project Admin invitation can be created by an authorized owner.
- The UI explicitly states that this is not platform-wide Wewed administrator authority.
- A revoked invitation fails closed and cannot be accepted.

No production wedding, guest, budget, vendor, timeline, seating or membership record was mutated for release verification.

---

# Production deployment verification

PR #136 was merged as main commit:

`f45486cba0780dbb05be28a49c2ae37bacafba57`

Vercel Git integration produced Production deployment:

`dpl_72eAR9Dsso2FfCeUUYgdKQUoe2X5`

The deployment is **READY**, targets `production`, and reports the exact merge commit above. Vercel assigned the production aliases including `wewed.pro` and `www.wewed.pro`.

Production runtime verification after deployment found:

- no `error` or `fatal` runtime log entries for the exact production deployment in the checked post-release interval;
- successful production HTTP traffic was present;
- a read-only public smoke request to the new `/join/[token]` route rendered the secure invitation shell on `wewed.pro`;
- a read-only request to `/api/join/[token]` using a deliberately nonexistent token returned HTTP **404** with `Invitation not found`, confirming the public join API fails closed without creating or changing data.

Authenticated and mutating release verification was deliberately kept in the isolated CI database rather than exercised against live wedding data.

---

# Delivered implementation contracts

## 1. Planner fixed-dark theme contract

The Planner is a deliberately fixed espresso/champagne product surface. It is now scoped as a dark theme rather than relying on a user's operating-system preference.

The release protects:

- input text;
- textarea text;
- select text/options;
- placeholders;
- carets;
- disabled controls;
- browser autofill;
- date/time controls and calendar indicators.

This closes the regression where a light global/system theme could produce espresso text on an espresso Planner input background.

## 2. Canonical A4 document contract

The release uses one shared document renderer for physical printing and browser **Save as PDF** rather than maintaining independent print and PDF implementations.

The contract provides:

- A4 portrait/landscape selection by worksheet type;
- printable margins;
- repeating table headers;
- page-break safeguards;
- long-text wrapping;
- text status labels that remain meaningful in grayscale;
- summary blocks;
- full worksheet, current filtered view and selected-record output where applicable;
- guest operational presets including RSVP, catering/dietary, check-in and seating assignment views.

## 3. Presentation-order contract

Worksheet reordering persists only presentation order using existing `WeddingContent`; no new schema or duplicate domain table was introduced.

The order API:

- checks the active wedding;
- requires the relevant edit permission;
- rejects foreign record IDs;
- rejects duplicate IDs;
- preserves newly-created/missing records deterministically;
- records an audit event.

Reordering does **not** rewrite Budget money values, Timeline clock times or other domain semantics.

## 4. Multi-select contract

The shared worksheet command centre provides a current-view selection model and safe bulk operations.

High-risk boundaries remain explicit:

- no generic bulk Budget `paidAmount` overwrite;
- no generic bulk Budget `actualCost` overwrite;
- no generic bulk Timeline clock-time rewrite;
- destructive actions show consequence-aware confirmation copy;
- existing validated per-record APIs remain authoritative for bulk record mutations.

## 5. Secure team invitation contract

Guest RSVP QR and team-access QR remain separate product concepts.

Team access QR/link behavior is:

`Create -> share/scan -> review wedding + inviter + role -> sign in -> explicitly accept -> revalidate -> create/activate wedding membership -> audit -> set active wedding`

Security properties include:

- 32-byte random opaque token;
- only SHA-256 token hash stored;
- optional invitee-email lock;
- configurable expiry;
- single use;
- revoke and rotate;
- invitation creation limits;
- known-token acceptance attempt limit;
- row locking during acceptance;
- audit events for creation, rotation, revocation, rejection and acceptance;
- existing stronger wedding memberships are not downgraded by a weaker invite.

Supported wedding/project membership roles are Owner/Partner, Wedding/Project Admin, Planner, Coordinator and Viewer/Member, subject to the inviter's existing `members.manage` authority and role-grant boundary.

**Wedding/Project Admin is a `WeddingMembership` role scoped to the selected wedding. QR acceptance never promotes `User.role` to platform-wide Wewed administrator.**

---

# Regression controls retained after release

The implementation is protected by:

- `src/lib/planner-worksheet-ux-regression.test.ts`;
- `.github/workflows/planner-worksheet-ux-ci.yml`;
- `tests/e2e/planner-worksheet-ux.spec.ts`;
- the existing complete Planner release matrix in the repository;
- Preview Data Safety and database integrity workflows.

Future Planner worksheet changes must continue to pass the complete matrix. A local styling fix that bypasses the fixed-dark surface contract, a second incompatible PDF renderer, an unaudited reorder store, or a QR path that directly grants authority should be treated as a regression.

---

# Known deliberate limitations

These are release design choices, not unresolved production blockers:

1. **PDF uses the browser Print / Save PDF pipeline.** There is not yet a separate server-generated binary PDF attachment endpoint. This intentionally keeps print and saved-PDF layouts on one canonical renderer.
2. **Bulk mutations reuse existing validated record endpoints.** Updates are applied through existing domain validation/side effects rather than introducing a new generic database bypass. This favors correctness over maximum bulk throughput.
3. **Raw team invitation links are deliberately ephemeral.** Wewed stores only the hash. If a raw link/QR is no longer available in the creator's session, the authorized inviter rotates the invitation to obtain a new one.
4. **Presentation order is separate from domain semantics.** For example, Timeline presentation ordering does not replace the event's actual clock time.
5. **Production verification is non-destructive.** Cross-account invitation acceptance and worksheet mutations are proven by the executable isolated browser gate, not by changing a real production wedding.

---

# Closeout decision

**APPROVED / PRODUCTION VERIFIED**

The implementation governed by `WW-PLANNER-UX-2026-08-17-01` is complete, merged and live. Its production deployment is READY, the exact implementation head passed the full repository release matrix and executable browser gate, and post-deployment production checks showed no release-specific runtime error/fatal logs in the checked interval.

This closeout stamp is the durable repository reference for the completed release:

`WW-PLANNER-UX-2026-08-17-01-CLOSEOUT`
