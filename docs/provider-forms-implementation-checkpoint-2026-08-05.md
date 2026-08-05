# Provider forms implementation checkpoint

Date: 5 August 2026

## Stamped implementation boundary

This checkpoint implements only the approved provider and planner form/profile work described in `vendor-forms-profiles-service-taxonomy-2026-08-05.md`.

No unrelated homepage redesign, couple workflow, planner authority, Tasks, Budget, Guests, Timeline, Seating, Invitations, Daily Operations, RSVP or billing change is authorised by this checkpoint.

Existing authentication, wedding isolation, invitation privacy, couple ownership, planner engagement and wedding-scoped `Vendor` behaviour remain separate and unchanged.

## Implemented

- Concise structured public provider application.
- Progressive approved-provider onboarding with local autosave and resume.
- Shared company profile stored separately from category-specific service offerings.
- Private verification details separated from public profile information.
- Category-specific fields, price context, capacity, inclusions, packages, portfolio and FAQ.
- Cakes as a first-class service category.
- Expanded wedding-service taxonomy covering venues, planning, photography/video, florals, catering, entertainment, décor, beauty, attire, transport, stationery, officiants, jewellery, travel/accommodation, tents, AV, bars, photo booths, content creation, gifts, choreography, security, childcare, cleaning and other services.
- Published-provider directory with category, keyword and service-area filters.
- Detailed public provider profiles containing only approved public information.
- Service-specific provider enquiries that create no wedding membership or authority.
- Richer planner onboarding and public planner profiles.
- Empty planner values are omitted rather than rendered as fabricated facts such as `0 years` or `0–any guests`.
- Safe website metadata suggestions that require provider confirmation before saving.

## Additive database objects

Private `wewed_admin` tables:

- `ProviderProfile`
- `ProviderVerification`
- `ProviderServiceOffering`
- `ProviderPackage`
- `ProviderPortfolioItem`
- `ProviderEnquiry`

Additive `PlannerProfile` fields:

- completed weddings
- team size
- structured profile details
- packages
- FAQ
- verification badges
- last profile update

No production wedding row is rewritten or deleted by these migrations.

## Privacy rules

- Verification documents, registration numbers, tax numbers and physical verification data are private.
- Public APIs return only published company and service-offering information.
- Wedding-scoped `Vendor` records are never used as public marketplace profiles.
- Sending a provider enquiry does not create planner engagement, wedding membership or any authority bundle.
- Couple-controlled sharing is recorded explicitly in each structured enquiry.

## Release gates

The feature must not merge until the exact pull-request head passes:

1. Prisma validation and clean migration deployment.
2. Zero schema drift.
3. Provider forms/profile source contracts.
4. Existing marketplace, privacy, invitation and wedding-isolation contracts.
5. Planner CRUD, including Task Test 11.
6. Production build.
7. Desktop and mobile Chromium checks.
8. Supabase security and performance review.
9. Exact-head Vercel preview review.
