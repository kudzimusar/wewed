# Wewed targeted preview remediation

Status: implementation in progress
Owner: Wewed product release
Date: 2026-08-04

## Purpose

This document is the implementation source of truth for the specific defects reported during review of the Wewed preview. This is not authorization for a new system-wide redesign. Work is limited to the six concerns below.

## Approved scope

### 1. Landing-page hero media

Observed issue: the reviewed stock wedding film includes a scene of two women dancing that may distract from the intended wedding message in the launch market.

Required change:

- Remove the reviewed stock film from the public experience.
- Use a Wewed-created wedding film showing one Black bride and one Black groom dancing together.
- Keep a Wewed-owned local poster image as the failure and reduced-motion fallback.
- Keep pause/play and reduced-motion behaviour accessible.
- Do not change the rest of the landing-page workflow.

### 2. Original public imagery

Observed issue: the public experience relies on third-party stock photographs and does not consistently present the requested Black couples.

Required change:

- Replace public Pexels and other stock-image references with original Wewed-owned artwork.
- Feature joyful Black bride-and-groom couples across the hero, stakeholder cards, inspiration and vendor discovery sections.
- Store still images locally under `public/media`.
- Do not use downloaded proprietary photographs from the internet.

### 3. Planner marketplace readability

Observed issue: profile fields and empty-state text have insufficient contrast against grey and dark surfaces.

Required change:

- Use light field backgrounds, dark field values and visible borders.
- Keep placeholders, disabled values, enquiry empty states and appointment empty states readable.
- Add sufficient bottom clearance so the fixed planner dock does not cover form controls.
- Do not change marketplace data, workflow, permissions or API behaviour.

### 4. Invitation templates and guest QR cards

Observed issue: invitation previews and QR cards are compressed inside the dialog, causing clipped or overlapping text and actions.

Required change:

- Increase the invitation dialog's usable desktop width while retaining a full-width mobile sheet.
- Use responsive template columns with a minimum readable card width.
- Keep each QR image, guest name, status, table information and action group inside its own card.
- Stack to one column when the available width is insufficient.
- Do not change QR credentials, RSVP exchange, rotation, sharing or invitation business logic.

### 5. Daily Planner Operations layout

Observed issue: KPI cards collapse into narrow vertical strips; currency values, labels, tabs and lower panels become clipped or overlap.

Required change:

- Increase the Daily Operations dialog's usable desktop width.
- Give KPI cards a minimum readable width.
- Keep tabs on one horizontally scrollable row rather than wrapping into fragments.
- Keep priority tasks, wedding-day timeline and lower sections in responsive readable columns.
- Do not change planner calculations, reminders, templates, seating, imports or rollback behaviour.

### 6. Wedding-first wording

Observed issue: Zimbabwe and Africa wording is repeated too often and makes the product feel political or campaign-led instead of wedding-led.

Required change:

- Remove repeated regional slogans from the homepage, shared public shell and public information template.
- Keep copy focused on weddings, privacy, planning, trusted professionals, guests and bringing people together.
- Do not erase the product's local relevance; simply avoid making geography the primary message.

## Explicitly out of scope

This remediation does not authorise a redesign of Tasks, Budget, Vendors, Guests, Timeline, Seating, Couple, Vendor or Admin pages beyond incidental shared behaviour required by the approved fixes. It does not change schema, migrations, APIs, permissions, privacy, wedding isolation, subscriptions or production data.

## Validation

The release gate requires:

- the reviewed stock film is not referenced by the public experience;
- the Wewed-created bride-and-groom film and local poster are rendered;
- no Pexels or other stock-image references remain in the public homepage, shell or public information template;
- marketplace fields and empty states remain readable;
- invitation previews and QR cards do not clip or overlap;
- Daily Operations KPIs, tabs and panels do not clip or overlap;
- public wording is wedding-first and does not repeat Zimbabwe/Africa campaign slogans;
- no horizontal page overflow at desktop, laptop, tablet or mobile widths;
- retained planner CRUD and priority-filter regression coverage;
- retained marketplace, privacy, invitation and wedding-isolation tests;
- exact-head Vercel preview review before merge.

The planner baseline remains mandatory, including Task Test 11: filtering to High priority must keep the UAT high-priority task visible, hide other priorities, preserve its In progress status and make no task-data changes.

## Merge rule

Do not merge this release until the exact branch head passes the targeted and retained automated gates and all six corrected areas have been visually reviewed in the exact-head Vercel preview.
