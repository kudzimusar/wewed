# Vendor forms, service profiles and marketplace data upgrade

Date: 2026-08-05
Status: implementation source of truth
Branch: `feat/africa-ready-product-experience`

## Non-negotiable boundary

This iteration changes only vendor/planner registration, provider onboarding, public provider/planner profile completeness, category taxonomy, and provider enquiry data needed to support those forms.

It must not redesign the homepage, authenticated planner workspace, Couple Tasks, Budget, Guests, Timeline, Seating, Invitations, Daily Operations, RSVP, billing, or existing wedding-scoped `Vendor` records. Existing authentication, wedding isolation, marketplace authority, planner engagement and invitation privacy contracts remain unchanged.

All database changes are additive. Existing rows remain valid. No production wedding data is rewritten, deleted, or exposed. Public provider data must come only from approved business accounts and explicitly published profiles.

## Product goals

1. Keep the initial public application short enough to complete.
2. Collect structured location, contact and service information during application.
3. Give approved providers a progressive, autosaved onboarding workspace.
4. Store one shared company profile plus one or more category-specific service offerings.
5. Make each service form ask only relevant questions.
6. Add Cakes as a first-class category and extend the vendor taxonomy.
7. Improve public planner and provider pages so incomplete values are never presented as meaningful facts.
8. Support structured, service-specific provider enquiries without granting wedding access.
9. Preserve current build stability, access boundaries and existing API contracts wherever possible.

## Approved category taxonomy

### Core discovery categories

- `venue` — Venues
- `planning` — Wedding planners and coordinators
- `photography` — Photography
- `videography` — Videography and livestreaming
- `florals` — Florists
- `catering` — Catering
- `cakes` — Wedding cakes and desserts
- `entertainment` — DJs, bands, MCs and performers
- `decor-rentals` — Décor, furniture and rentals
- `beauty` — Hair and makeup
- `attire` — Bridal wear, tailoring and formalwear
- `transport` — Transport and car hire
- `stationery` — Invitations, signage and stationery
- `officiants` — Officiants and celebrants
- `jewellery` — Jewellery and accessories
- `accommodation-travel` — Accommodation and travel
- `tents-marquees` — Tents and marquees
- `lighting-av` — Lighting, sound and audiovisual production
- `bar-beverages` — Mobile bars and beverage services
- `photo-booth` — Photo booths
- `content-creation` — Wedding content creators
- `gifts-favours` — Gifts and wedding favours
- `choreography` — Choreographers and dance instructors
- `security` — Security
- `childcare` — Childcare
- `cleaning-sanitation` — Cleaning and sanitation
- `other` — Other wedding service

The homepage remains limited to its approved featured categories. The complete taxonomy is available in registration, provider management and the full directory.

## Progressive form stages

### Stage 1 — public application

Required:

- applicant full name
- verified email identity
- password
- phone and country code
- account type and requested role
- business/trading name
- country, city and primary service area
- one or more provider categories for venue/vendor applications
- website and optional social profile
- preferred plan
- terms declaration

Optional:

- short application note
- business registration number

The application creates a pending business account only. It does not create immediate dashboard, administrative or wedding access.

### Stage 2 — private verification

Stored privately and never returned by public APIs:

- registered legal name
- registration/tax identifiers
- authorised representative
- physical address
- secondary contact
- identity/business/insurance/permit document status
- verification notes and review status

The public profile may expose only safe badges such as Identity verified, Business verified, Insurance provided, or Permit reviewed.

### Stage 3 — shared public company profile

- public name, headline and detailed description
- country, city, service areas and travel radius
- phone, email, website and social links
- years operating, team size and typical response time
- minimum booking notice
- languages
- accepted payment methods
- deposit, cancellation, refund and travel policies
- accessibility support
- cultural/traditional/religious wedding experience
- portfolio cover image and gallery
- FAQ
- visibility state
- completion score and last updated timestamp

### Stage 4 — service offerings

A business may own multiple offerings. Every offering contains common fields:

- category and display label
- active/draft state
- short description
- starting price, maximum indicative price, currency and pricing model
- minimum and maximum capacity where relevant
- booking lead time
- service areas and travel policy
- inclusions
- service-specific structured details
- packages
- portfolio items

## Service-specific field matrix

### Planners

Packages, planning/coordination types, years operating, completed weddings, supported budget bands, guest range, wedding styles, regions, team size, consultation process, fee model, response time, availability, portfolio, references, inclusions and exclusions.

### Venues

Seated/standing capacity, indoor/outdoor spaces, ceremony/reception options, accommodation, parking, accessibility, catering/bar rules, curfew, noise restrictions, backup power, weather contingency, bathrooms, bridal suites, security, furniture and setup windows.

### Photography / videography

Style, coverage hours, number of shooters, edited image/video quantity, turnaround, albums/prints, drone, engagement sessions, raw-file policy, backup equipment, livestreaming, usage rights and travel.

### Florals

Fresh/artificial/dried flowers, design styles, minimum spend, bouquets, installations, centrepieces, delivery, setup, teardown, consultations, substitutions, seasonal availability and booking lead time.

### Catering

Cuisine, menu/service style, dietary and allergy support, halal/kosher capability, guest limits, tastings, staffing, crockery, beverages, kitchen requirements, transport and food-safety certification.

### Cakes

Cake styles, tiers, serving range, flavours, fillings, icing, allergy/dietary options, vegan/gluten-free capability, consultations, tastings, lead time, delivery/setup, cake stands, matching desserts and pricing method.

### Entertainment

Performer type, group size, performance duration, repertoire, equipment, power/stage requirements, sound limits, playlist requests, travel, setup and overtime.

### Décor / rentals

Inventory categories and quantities, dimensions/colours/themes, tents/tables/chairs/linens/lighting, delivery radius, installation, collection, replacement charges, damage deposit and custom design.

Other categories use a dedicated schema in the shared service-field configuration. No category is forced to answer irrelevant questions.

## Form interaction rules

- conditional sections driven by selected category
- searchable multi-selects for categories, service areas, languages and styles
- checkbox groups for inclusions, amenities and capabilities
- constrained ranges for price, capacity, distance and lead time
- repeatable package and portfolio rows
- address/country/city suggestions with manual override
- phone country-code assistance
- optional website metadata suggestions requiring explicit user confirmation
- autosave draft and resume
- completion score with missing-field guidance
- preview of public information before publication
- inline validation and accessible errors

## Public profile rules

- Render only populated, approved public data.
- Never show `0 years`, `0–any guests`, empty chips or placeholder facts.
- Use honest text such as `Experience not yet provided` only in private management views; omit empty public sections.
- Show service offerings, starting prices, packages, portfolio, response time, booking notice, policies, FAQ, verification badges and last-updated date when supplied.
- Existing limited UAT planner profiles remain valid and are not fabricated or auto-enriched.

## Provider enquiry rules

- Enquiry requires a published provider offering.
- Service-specific questions are derived from the offering category.
- Logged-in couples may authorise selected wedding summary fields; no planner/provider wedding membership is created by an enquiry.
- Public visitors may submit only where existing authentication and anti-abuse policy permits; otherwise they are directed to sign in.
- Enquiries store structured answers, message, status and audit timestamps.

## Database design

Additive tables:

- `ProviderProfile` — one shared profile per venue/vendor business account
- `ProviderVerification` — private verification state per business
- `ProviderServiceOffering` — multiple category-specific offerings per business
- `ProviderPackage` — packages under an offering
- `ProviderPortfolioItem` — media under an offering
- `ProviderEnquiry` — structured service enquiry

`PlannerProfile` receives additive `profileDetails`, `packages`, `faq`, `verificationBadges`, `completedWeddings`, `teamSize` and `lastProfileUpdate` fields.

Existing `BusinessAccount.metadata.publicProfile` remains readable during migration. The new provider APIs prefer normalized tables and fall back to legacy metadata until an account is saved in the new manager.

## Security and privacy

- Only active members of an active, completely onboarded venue/vendor business may edit its normalized profile.
- Verification data is never selected by public directory/profile APIs.
- Public directory requires business approval, onboarding completion, profile publication and at least one published offering.
- Wedding-scoped `Vendor` rows remain private and separate.
- Mutations are audited in `BusinessAuditLog`.
- All free-text, URLs, numeric ranges and JSON lists are validated and length-limited.

## Acceptance gates

- migration applies cleanly to a fresh PostgreSQL database and to the current Supabase project
- no Prisma/schema drift regression in the existing workflow
- legacy provider metadata continues to render
- Cakes appears in registration, profile management and provider directory
- category-specific form sections change correctly
- draft autosave and explicit publish both work
- incomplete planner values are not shown publicly
- public directory never returns verification-private fields or wedding-scoped vendors
- service-specific enquiry creates no wedding authority or membership
- desktop and mobile forms have no horizontal overflow, clipping or inaccessible controls
- all existing planner marketplace, privacy, invitation, wedding-isolation, Task Test 11 and production build gates remain green
- exact-head Vercel preview is reviewed before merge

## Release rule

Do not merge until the exact PR head has passed all CI, Supabase security/performance advisor review after DDL, and exact-head Vercel preview validation. No unrelated change is authorised by this document.
