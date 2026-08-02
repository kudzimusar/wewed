# Wewed Planner Profiles, Discovery and Secure Appointment — Delivery Goal

## Goal

Deliver a production-ready, regression-free planner marketplace that connects existing Wewed planner business accounts to couple-owned weddings through explicit enquiry, appointment and delegated-authority lifecycles.

## Required outcome

- Planners can create professional profiles, submit them for Wewed review and publish approved profiles.
- Couples can search published planners, inspect approved public information, save planners and submit structured wedding enquiries.
- Planners can respond without seeing the private wedding workspace.
- Appointment requires planner acceptance and a separate couple authority grant.
- Authority activation atomically creates or reactivates a wedding-scoped membership and the corresponding business relationship.
- Pause, completion or revocation atomically removes operational access while preserving history and audit events.
- Every couple retains their existing subscription, wedding records and slug-based homepage.
- Billing is read-only to this capability. Stripe Checkout, webhooks, Customer Portal, pricing and PaymentRecord are unchanged.
- Public, couple, planner and administrator data remain isolated and fail closed.

## Release gate

The exact release head must pass clean PostgreSQL migrations, schema drift detection, marketplace source and PostgreSQL contracts, all existing planner tests, production build, Playwright Chromium tests, Vercel Preview smoke checks and database-isolation verification before production promotion.
