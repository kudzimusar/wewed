# Wewed Planner Profiles, Discovery and Secure Appointment

**Implementation plan**  
**Scope:** planner marketplace and delegated wedding authority  
**Payment boundary:** no rewards, commissions, Stripe Connect, split payments, payout logic, or changes to subscription reconciliation

## Objective

Add a secure marketplace above the existing Wewed business-account and wedding-membership graph so couples can discover a planner, exchange a structured enquiry, appoint the planner, and explicitly authorize that planner to operate the existing wedding workspace.

The couple remains the owner of the subscription, couple profile, public wedding homepage, wedding data and delegated permissions. The planner retains a separate planning-business account and professional marketplace profile.

## Existing foundation retained

- Supabase Auth identity and signed Wewed application sessions.
- `User`, `UserProfile`, `Couple`, `Wedding` and slug-resolved wedding content.
- Private `wewed_admin` business accounts, memberships, resource links and audit records.
- `WeddingMembership` as the authoritative operational access boundary.
- Existing `/planner` application, modules, templates, imports, exports and wedding switching.
- Canon and Forever Stripe Billing, webhook reconciliation and `PaymentRecord` unchanged.

## Product capabilities

### Planner professional profile

A planner connected to an active, completely onboarded planning-company account can maintain public professional fields including name, headline, biography, experience, service areas, services, wedding styles, languages, price band, supported wedding size, portfolio links and availability.

Profile states are `draft`, `submitted`, `changes_requested`, `published`, `rejected`, `suspended` and `archived`. Editing a non-suspended profile returns it to draft and clears prior publication until it is reviewed again.

### Public discovery

Only profiles that are published and connected to active, completely onboarded planning businesses appear publicly. Search supports name, headline, service area, service, wedding style, price band and availability. Public responses never include business membership details, client lists, private calendar entries, enquiries, wedding records or billing metadata.

### Couple shortlist and structured enquiry

A signed-in couple owner may shortlist published planners and submit a structured wedding summary containing the wedding date, broad location, guest range, budget band, requested services, wedding styles and a message. No operational wedding records are shared and no access is created by an enquiry.

### Appointment handshake

1. Couple submits an enquiry.
2. Planner responds and records accepted interest.
3. Couple creates a formal appointment request.
4. A planner business member accepts that request.
5. Couple selects an authority bundle.
6. One transaction activates or updates `WeddingMembership`, links the planning business to the wedding as manager, records the authority snapshot and writes the audit event.

The planner cannot self-authorize. The couple cannot authorize an appointment the planner has not accepted.

### Delegated authority

Four canonical bundles are supported:

- **Consultation:** planner overview read access.
- **Planning:** planner operations with vendor/timeline editing and read-only guest/budget/seating access.
- **Coordination:** operational guest, vendor, timeline and seating editing.
- **Full coordination:** full existing planner operations including budget, content, media and import/export.

No bundle includes account ownership, subscription management, billing access, wedding deletion, couple removal or authority administration.

### Authority lifecycle

The couple can pause, resume, complete or revoke an engagement. A pause or revocation immediately makes the corresponding wedding membership non-active while retaining engagement and audit history. Resume reactivates only the previously authorized canonical bundle after the planner business remains valid.

### Couple homepage

Every wedding retains a slug-resolved public homepage at `/w/{weddingSlug}`. The existing root route remains compatible with the flagship/default wedding. Planner appointment does not transfer ownership of the homepage.

### Wewed administration

Wewed administrators with existing account-review permission can review submitted planner profiles and publish, request changes, reject or suspend. Platform administration remains separate from wedding operational access.

## Data model

All marketplace records are server-owned tables in the private `wewed_admin` schema with revoked `PUBLIC`, `anon` and `authenticated` privileges. Security-invoker public compatibility views exist only for the server-side SQL convention already used by Wewed.

- `PlannerProfile`: one profile per planning business.
- `PlannerShortlist`: couple-user shortlist scoped to a wedding.
- `PlannerEnquiry`: structured shared summary and response lifecycle.
- `PlannerEngagement`: durable appointment, authority snapshot and lifecycle.

Database checks constrain states, JSON shapes, ranges, duplicate open enquiries and one current engagement per wedding. Trigger guards verify that profiles belong to valid planning-company accounts and enquiries connect an owning couple account, wedding, published profile and planning business consistently.

## Security invariants

- Public profile discovery is allowlisted and read-only.
- All protected routes verify the signed application session against the active database user.
- Couple operations require owner membership of the active wedding.
- Planner operations require active membership in a valid planning business.
- Enquiry does not create `WeddingMembership` or a managerial business link.
- Final authorization is transactional and auditable.
- Revocation does not delete history.
- Cross-wedding and cross-business identifiers are revalidated server-side.
- Browser roles receive no direct access to marketplace tables or views.
- Stripe code, subscription columns, webhook logic and payment records are outside the change set.

## Interfaces

- `/planners` — public planner directory.
- `/planners/[slug]` — public planner profile.
- `/couple/planners` — couple discovery, shortlist, enquiry and authority centre.
- `/planner/marketplace` — planner profile, enquiry and appointment centre.
- `/admin/planner-profiles` — Wewed profile governance.
- `/w/[slug]` — canonical couple wedding homepage.

## Validation and release gates

1. Clean PostgreSQL migration deployment.
2. Prisma schema validation and zero managed-schema drift.
3. Marketplace source contract.
4. PostgreSQL stakeholder-graph, no-access-before-authorization and revocation integration.
5. Existing planner parity, integrity, Stage 2–10 and Phase 2–6 tests.
6. Production Next.js build.
7. Playwright Chromium test covering public discovery, couple enquiry, planner interest, appointment, planner acceptance, couple authority, membership activation and revocation.
8. Exact-head Vercel Preview readiness and route smoke tests.
9. Database migration applied only after exact-head code gates pass.
10. Production deployment, health, runtime-log and database-invariant verification.

## Explicitly out of scope

Rewards, commissions, lifetime returns, referral attribution, marketplace booking charges, planner/vendor payouts, Stripe Connect, split payments, escrow, changes to Canon/Forever prices, subscription invoice handling, refunds and chargeback allocation.
