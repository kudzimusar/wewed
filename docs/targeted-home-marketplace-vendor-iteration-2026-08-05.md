# Wewed targeted home, marketplace and provider iteration

Date: 2026-08-05
Branch: `feat/africa-ready-product-experience`
PR: #68

## Implementation source of truth

This document authorizes only the six corrections confirmed after preview review. It is not authorization for a general redesign, page-by-page visual refresh, data-model rewrite, or changes to unrelated planner workflows.

## In scope

### 1. Cinematic homepage hero

- Keep the premium full-screen video treatment.
- Use the Wewed-created Higgsfield film of one Black bride and one Black groom dancing at an elegant outdoor wedding reception.
- Keep muted autoplay, looping, `playsInline`, responsive cropping and an accessible pause/play control.
- Use the local Wewed couple artwork only as a loading, reduced-motion or playback-failure poster.
- Do not replace the film with an illustration-led hero.

### 2. Controlled marketplace fields

- Keep business name, profile name, slug, headline, biography and portfolio URLs as text fields.
- Convert constrained classifications to labelled selects or multi-selects: service areas, services, wedding styles, languages, guest-capacity range, price band and availability.
- Preserve the existing `/api/marketplace/profile` payload and PlannerProfile storage contract.
- Do not modify enquiries, appointments, delegated authority or publication workflow.

### 3. Wedding-first public wording

- Remove repeated campaign slogans such as “Zimbabwe first · designed for Africa”, “Built for African couples”, “Real African love” and “Zimbabwe launch market”.
- Keep geographic information only when it is live operational data, such as a profile service area, wedding venue, currency or account setting.
- Do not remove valid user-entered Zimbabwean locations from real records.

### 4. Honest Wedding Journey card

- Signed-out visitors see an explicitly labelled example/preview with no real couple names or private wedding data.
- Signed-in users see their authorized `/api/auth/me` identity and active-wedding summary.
- The card must use the real wedding title, date and venue returned by the existing permission-aware session endpoint.
- No public request may reveal another wedding’s data.
- Do not present static sample names such as Tariro & Tawanda as live data.

### 5. Live homepage account state

- The public header reads the existing `/api/auth/me` session.
- Signed-out state shows Sign in and Get started and clearly indicates that no account is active.
- Signed-in state shows the user’s display name, role and correct workspace destination.
- Sign out must clear both the Wewed application cookie and the Supabase session.
- No simulated account state or hard-coded user identity.

### 6. Interactive vendor and venue discovery

- Existing vendor-category cards become links to a filtered provider directory.
- Public discovery may use only active, completely onboarded venue/vendor business accounts and public profile metadata.
- New service providers can open registration with the relevant account type and service category preselected.
- Existing approved providers receive a profile-management entry point using their business account.
- Wedding-scoped `Vendor` records must never be exposed as public provider profiles.
- Existing provider architecture (`BusinessAccount`, `BusinessAccountMember`, metadata and public registration) must be reused; no parallel private-vendor data store.

## Explicitly out of scope

- Tasks, Budget, Guests, Timeline, Seating, Invitations, Daily Operations or planner-workspace redesign.
- Changes to planner enquiry, appointment, engagement, authority or wedding-isolation rules.
- Changes to billing, subscriptions, Canon, RSVP credentials or invitation privacy.
- Replacing unrelated imagery or copy on authenticated product pages.
- Database writes to existing wedding-scoped Vendor records.

## Data and security boundaries

- `/api/auth/me` remains the source of truth for homepage identity and active wedding.
- Public provider queries are restricted to active and completely onboarded `BusinessAccount` records of type `venue` or `vendor`.
- Provider profile updates require a signed-in active member of the matching business account.
- Public provider metadata is explicitly allow-listed before rendering.
- Supabase is used for schema verification and controlled live-data validation; no production wedding data is modified for this iteration.

## Acceptance criteria

1. Hero renders the Higgsfield bride-and-groom film; poster appears only as fallback.
2. No targeted public page contains the removed Zimbabwe/Africa campaign slogans.
3. Marketplace controlled classifications render as selects/multi-selects and save through the existing API.
4. Signed-out Wedding Journey is labelled as an example and contains no couple identity.
5. Signed-in homepage displays the authorized user and active wedding from `/api/auth/me`.
6. Header sign-out clears the live session.
7. Every vendor card opens a matching filtered provider route.
8. Registration can be opened preselected for venue/vendor and category.
9. Approved provider members can open and update their public company profile.
10. Public discovery never uses wedding-scoped `Vendor` rows.
11. Existing privacy, marketplace, invitation and wedding-isolation tests remain green.
12. Task Test 11 remains green: High priority shows `UAT-TASK-001 Confirm florist arrival`, hides other priorities, preserves `In progress`, and makes no task mutation.

## Release gate

Do not merge until the exact PR head passes source contracts, PostgreSQL integrations, migrations/drift checks, production build, desktop/mobile Chromium, Task Test 11, and an exact-head Vercel preview review of the six items above.