# Planner UAT Remediation — 2026-08-09

Status: **In progress — PR #96 remains draft until UAT and CI pass**

## Objective

Resolve the UAT gaps discovered in the planner portfolio/workspace preview without weakening wedding access controls or creating duplicate operational data. The release must feel dependable on mobile, make portfolio-to-client navigation obvious, connect vendors to budget costs through canonical IDs, and make enquiry actions visibly and durably state-driven.

## Findings and acceptance criteria

### UAT-01 — Transient client failure / `Failed to fetch`

**Observed**
- Browser displayed: `Application error: a client-side exception has occurred...` and recovered after refresh.
- Vendors worksheet also displayed `Failed to fetch`.
- Sampled Vercel preview runtime logs did not show a corresponding server-side error cluster, so client/network/session behavior must be investigated rather than assumed to be a backend 5xx.

**Severity:** Release blocker until bounded and regression-tested.

**Acceptance**
- Planner portfolio and worksheet fetch paths handle non-JSON responses, aborted/network requests, and expired/transitioning session state without an unhandled client exception.
- Fetch failure leaves a clear recoverable UI with Retry; it does not crash the planner shell.
- Rapid wedding switching, refresh, back/forward navigation, and repeated Vendors loads do not produce a client exception.
- Relevant client-side failures are logged with route/context without exposing sensitive data.

### UAT-02 — Portfolio ↔ client navigation is not self-explanatory

**Observed**
- A tester can discover the global Workspace tab, but there is no explicit contextual path from `Your wedding command centre` to a selected client workspace and back.

**Severity:** High UX blocker.

**Acceptance**
- Every managed wedding has an explicit `Open wedding workspace` action.
- Inside a client workspace, an obvious `All weddings` / `Portfolio` action returns to the planner command centre.
- The active wedding/couple context remains visible while working.
- Bottom navigation remains global navigation and is not the only way to understand the hierarchy.

### UAT-03 — Mobile command centre wastes vertical space

**Observed**
- Portfolio KPI cards render as large full-width blocks on mobile, causing a small number of metrics to consume most of the viewport.

**Severity:** High mobile UX issue.

**Acceptance**
- At 360px, 390px and 430px widths, compact metrics use a two-column mobile grid where practical.
- KPI typography/padding is reduced on mobile while remaining touch/readability accessible.
- Action queue and wedding cards remain full-width because they contain actionable content.
- No horizontal overflow and no controls hidden beneath fixed navigation.

### UAT-04 — Vendor ↔ Budget relationship is incomplete

**Observed**
- `BudgetItem` already stores `vendorId` and `vendorName`, and the Budget API validates `vendorId` against the active wedding.
- `vendorId` is not currently an enforced Prisma/Postgres relation.
- Vendor records do not have an email field.
- Planner budget UI does not provide a practical existing-vendor selection flow.

**Severity:** Data-integrity / operational workflow issue.

**Acceptance**
- Vendor has optional email storage exposed through create/edit/read APIs and planner UI.
- Budget item can optionally link to an existing Vendor by canonical ID.
- Database enforces the BudgetItem → Vendor relation with safe delete behavior; existing unlinked text values remain valid.
- Selecting a vendor fills the display name/contact context without copying identity as the source of truth.
- An external/manual vendor can still be used when no existing record is appropriate.

### UAT-05 — Reusable entity lookup / autofetch

**Observed**
- Existing people/vendors must currently be repeatedly re-entered in forms.

**Severity:** Medium-high workflow and duplicate-data risk.

**Acceptance**
- Introduce a reusable async entity picker pattern, beginning with wedding vendors.
- Typing searches authorized entities for the active wedding and lets the user explicitly select a result.
- No fuzzy match silently assigns an entity.
- `Add new vendor` remains available when no result is appropriate.
- Component/API design can later support planners, couples, providers, contacts and team members without bypassing authorization.

### UAT-06 — Enquiry actions lack durable state feedback

**Observed**
- An enquiry can display `ACCEPTED INTEREST` while still presenting `Accept interest`, `Respond`, and `Decline` as if no transition occurred.
- Planner receives insufficient confirmation that an action succeeded.

**Severity:** High trust/workflow issue.

**Acceptance**
- Enquiry lifecycle is explicitly state-driven and server-confirmed.
- `Accept interest`: pending UI → success confirmation → accepted visual state; incompatible actions disappear/disable after confirmation.
- `Decline`: pending UI → declined/closed state and moves out of the open queue.
- `Respond`: successful send is visibly confirmed with state/timestamp where supported.
- Refresh/relogin preserves the same server state.
- Mutations are idempotent against duplicate taps/retries.
- Accepting interest does **not** automatically grant wedding appointment/authority; appointment remains a separate governed transition.

## Implementation sequence

### Phase 1 — Stability
1. Harden planner shell/portfolio fetch handling.
2. Inspect Vendors request/session behavior and recoverable error UX.
3. Add focused regression coverage for wedding switching and failed fetches.

### Phase 2 — Navigation + mobile
1. Add portfolio return action/context to the wedding workspace.
2. Make portfolio wedding CTA explicit.
3. Compact mobile KPI grid and spacing at 360/390/430 widths.

### Phase 3 — Vendor + Budget integrity
1. Add Vendor email.
2. Complete BudgetItem → Vendor canonical relation.
3. Update Vendor/Budget APIs and forms.
4. Add reusable authorized vendor picker.
5. Preserve manual/external vendor path and legacy `vendorName` compatibility.

### Phase 4 — Enquiry lifecycle
1. Map existing enquiry/appointment schema and endpoints.
2. Make action mutations state-safe/idempotent.
3. Render Open / Responded / Accepted / Declined state rather than static controls.
4. Keep accepted interest separate from formal appointment authority.

### Phase 5 — Regression / UAT gate
Validate:
- portfolio ↔ multiple weddings ↔ worksheets;
- 360/390/430 mobile layouts;
- Vendors load/retry and refresh/relogin;
- vendor email persistence;
- existing vendor search and Budget linking;
- manual vendor fallback;
- budget edit/read persistence;
- enquiry accept/respond/decline persistence and duplicate-click safety;
- existing Tasks/Budget/Vendors/Guests/Timeline/Seating workflows;
- authorization boundaries for couple/admin/planner roles.

## Release rule

PR #96 stays draft. No production merge or production database migration occurs until the branch build, dedicated planner tests, relevant PostgreSQL/migration checks, browser regression gates, and focused UAT are satisfactory.
