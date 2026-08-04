# Wewed targeted preview remediation

Status: implementation in progress
Owner: Wewed product release
Date: 2026-08-04

## Purpose

This document is the implementation source of truth for the specific defects reported during review of the Africa-ready preview. This is not authorization for a new system-wide redesign. Work is limited to the four visual problems listed below.

## Approved scope

### 1. Landing-page hero media

Observed issue: the current remote wedding film includes a scene of two women dancing that may be culturally misinterpreted in the Zimbabwean launch market.

Required change:

- Remove that remote film from the rendered landing-page experience.
- Use a Wewed-owned local hero visual showing a joyful Black Zimbabwean bride and groom.
- Hide the film control while the static replacement is in use.
- Do not change the rest of the landing-page structure in this remediation.
- A replacement motion clip may be added later only when it can be generated on the approved free tier and reviewed before use.

### 2. Planner marketplace readability

Observed issue: profile fields and empty-state text have insufficient contrast against grey and dark surfaces.

Required change:

- Use light field backgrounds, dark field values and visible borders.
- Keep placeholders, disabled values, enquiry empty states and appointment empty states readable.
- Add sufficient bottom clearance so the fixed planner dock does not cover form controls.
- Do not change marketplace data, workflow, permissions or API behavior.

### 3. Invitation templates and guest QR cards

Observed issue: invitation previews and QR cards are compressed inside the dialog, causing clipped or overlapping text and actions.

Required change:

- Increase the invitation dialog's usable desktop width while retaining a full-width mobile sheet.
- Use responsive template columns with a minimum readable card width.
- Keep each QR image, guest name, status, table information and action group inside its own card.
- Stack to one column when the available width is insufficient.
- Do not change QR credentials, RSVP exchange, rotation, sharing or invitation business logic.

### 4. Daily Planner Operations layout

Observed issue: KPI cards collapse into narrow vertical strips; currency values, labels, tabs and lower panels become clipped or overlap.

Required change:

- Increase the Daily Operations dialog's usable desktop width.
- Give KPI cards a minimum readable width.
- Keep tabs on one horizontally scrollable row rather than wrapping into fragments.
- Keep priority tasks, wedding-day timeline and lower sections in responsive readable columns.
- Do not change planner calculations, reminders, templates, seating, imports or rollback behavior.

## Explicitly out of scope

This remediation does not authorize a redesign of Tasks, Budget, Vendors, Guests, Timeline, Seating, Couple, Vendor or Admin pages beyond any incidental shared behavior required by the four approved fixes. It does not change schema, migrations, APIs, permissions, privacy, wedding isolation, subscriptions or production data.

## Validation

The release gate requires:

- the remote landing-page film is not rendered;
- the local Black bride-and-groom hero visual is rendered;
- marketplace fields and empty states remain readable;
- invitation previews and QR cards do not clip or overlap;
- Daily Operations KPIs, tabs and panels do not clip or overlap;
- no horizontal page overflow at desktop, laptop, tablet or mobile widths;
- retained planner CRUD and priority-filter regression coverage;
- retained marketplace, privacy, invitation and wedding-isolation tests;
- exact-head Vercel preview review before merge.

The planner baseline remains mandatory, including Task Test 11: filtering to High priority must keep the UAT high-priority task visible, hide other priorities, preserve its In progress status and make no task-data changes.

## Merge rule

Do not merge this release until the exact branch head passes the targeted and retained automated gates and the four corrected surfaces have been visually reviewed in the exact-head Vercel preview.
