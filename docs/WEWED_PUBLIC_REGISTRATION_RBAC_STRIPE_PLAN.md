# Wewed Public Registration, RBAC Provisioning and Stripe Billing Plan

**Recorded:** July 30, 2026  
**Branch:** `feature/wewed-admin-console-mvp`  
**Production status:** Not merged or promoted

## Objective

Extend the Wewed parent-company platform with three connected capabilities:

1. administrators can add or invite Wewed platform members and assign actual RBAC roles;
2. prospective couples, planners, venues, vendors and business clients can register from public pages;
3. approved and internally onboarded business accounts can pay through Stripe Billing.

## Public registration workflow

1. A visitor opens `/register` from the public website.
2. The visitor supplies contact details, requested account type, intended role and preferred plan.
3. Supabase Auth creates the identity and handles email confirmation according to the project configuration.
4. Wewed creates an inactive application user, a `pending_review` business account and an invited business membership.
5. The application appears automatically in the existing Admin Console approval queue.
6. A Wewed administrator approves or rejects the business account through the existing audited lifecycle workflow.
7. Approval does not bypass internal onboarding. Wewed staff still assign the final workspace, wedding relationships, business role and activation state.
8. Rejection preserves the application and audit history without granting dashboard access.

Public applicants may request a business or client role, but they can never self-assign a Wewed platform administrator role.

## RBAC member provisioning

Add a protected `/admin/roles` workspace with:

- invite/add administrator form;
- email and display-name fields;
- role selection for Super Admin, Operations Admin, Billing Admin, Support Admin and Analyst;
- existing membership role and status controls;
- prevention of removing the final active Super Admin;
- server-side permission enforcement and audit records.

New administrators are invited through Supabase Auth. Existing client/planner identities are not silently converted into Wewed platform administrators; a separate administrative identity is required where role separation would otherwise be lost.

## Stripe integration shape

Use standard Stripe Billing, not Stripe Connect.

- Wewed charges its own SaaS customers.
- Stripe-hosted Checkout collects subscription payment details.
- Stripe Customer Portal handles payment-method updates, cancellation and subscription self-management.
- Webhooks synchronize subscription and invoice/payment state into existing Wewed business-account metadata and `PaymentRecord` data.
- Existing manual payment records remain supported.
- Price IDs are configured through Vercel environment variables; code must not invent production prices.
- Free accounts do not require Checkout.
- Enterprise may remain manual or sales-assisted until an enterprise Stripe Price is configured.

## Stripe environment variables

Required for live operation:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER` or `STRIPE_PRICE_CANON`
- `STRIPE_PRICE_PROFESSIONAL` or `STRIPE_PRICE_FOREVER`
- optional `STRIPE_PRICE_ENTERPRISE`

## Security and regression controls

- Public registration never grants immediate dashboard access.
- Registration rate limiting and duplicate-email checks are applied server-side.
- Supabase service-role credentials remain server-only.
- Stripe webhook signatures are verified before processing.
- Stripe event processing is idempotent through the existing business audit log.
- No raw card details are stored by Wewed.
- Existing `/planner`, wedding switching, memberships and Admin Console lifecycle controls remain unchanged.
- New CI contracts cover registration invariants, RBAC invitation controls, Stripe signature verification and route isolation.

## Definition of done

- A public visitor can submit a registration application.
- The application appears as `pending_review` in `/admin`.
- An authorized Super/Operations administrator can approve or reject it.
- Internal onboarding remains available after approval.
- An authorized Super Admin can invite a new platform administrator and assign a role.
- Existing platform roles can be updated or suspended with audit history.
- An active business member can open Stripe Checkout for a configured paid plan.
- An active Stripe customer can open Customer Portal.
- Signed Stripe webhooks update Wewed subscription and payment status.
- Existing planner and admin regression gates remain green.
