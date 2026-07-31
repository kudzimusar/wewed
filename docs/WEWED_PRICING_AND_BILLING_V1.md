# Wewed Pricing and Billing V1

**Recorded:** July 31, 2026  
**Branch:** `feature/wewed-pricing-billing-v1`  
**Release posture:** additive and backward-compatible; existing Free accounts remain active.

## Commercial structure

| Plan | Monthly | Annual | Intended customer | Checkout mode |
|---|---:|---:|---|---|
| Free | $0 | $0 | Couples and first-time Wewed users | No Stripe subscription |
| Canon | $15 | $150 | Couples and solo wedding professionals | Self-service Stripe Checkout |
| Forever | $39 | $390 | Planners, planning companies and growing teams | Self-service Stripe Checkout |
| Enterprise | From $129 | From $1,290 | Venues, agencies and larger portfolios | Sales-assisted onboarding |

Annual Canon and Forever pricing provides two months free relative to monthly billing.

## Product boundaries

### Free

- Public wedding page and mobile experience
- RSVP, guest participation, live wall and memories
- One active wedding workspace
- Wewed branding
- Community support

### Canon

- Everything in Free
- Full planner workspace: tasks, budget, guests, vendors and timeline
- Private or link-only wedding experience
- Reusable planner templates and exports
- Email support

### Forever

- Everything in Canon
- Multi-wedding planner operations
- Team roles and permissions
- Operational analytics and audit history
- Priority onboarding and support

### Enterprise

- Everything in Forever
- Custom account and portfolio structure
- Dedicated implementation and data onboarding
- Advanced governance and support controls
- Contracted service and support terms

Enterprise is not exposed as unattended Checkout in V1. The displayed amount is an indicative starting price, and final scope is agreed through internal onboarding.

## Stripe catalog created

Connected Stripe account: `acct_1MUuwxAqp8pYwqz4`.

### Canon

- Product: `prod_Uz6aEYUW5JJa9s`
- Monthly Price: `price_1Tz8N4Aqp8pYwqz4eivvHbBE`
- Annual Price: `price_1Tz8NgAqp8pYwqz411lZk41c`

### Forever

- Product: `prod_Uz6b7u9d0jZNTs`
- Monthly Price: `price_1Tz8NxAqp8pYwqz4KGXwgPDE`
- Annual Price: `price_1Tz8O6Aqp8pYwqz4mY4pELhR`

All four prices are live-mode recurring USD prices. No customer or subscription was created during catalog setup.

## Required production environment variables

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_CANON_MONTHLY=price_1Tz8N4Aqp8pYwqz4eivvHbBE
STRIPE_PRICE_CANON_ANNUAL=price_1Tz8NgAqp8pYwqz411lZk41c
STRIPE_PRICE_FOREVER_MONTHLY=price_1Tz8NxAqp8pYwqz4KGXwgPDE
STRIPE_PRICE_FOREVER_ANNUAL=price_1Tz8O6Aqp8pYwqz4mY4pELhR
```

Legacy monthly variables remain supported temporarily as fallbacks:

```text
STRIPE_PRICE_STARTER
STRIPE_PRICE_CANON
STRIPE_PRICE_PROFESSIONAL
STRIPE_PRICE_FOREVER
```

## Checkout and synchronization flow

1. An approved, fully onboarded business owner or billing manager opens `/billing`.
2. The user selects Canon or Forever and monthly or annual billing.
3. Wewed creates or reuses the Stripe Customer attached to the business account.
4. Wewed creates Stripe-hosted Checkout with business-account, plan and interval metadata.
5. Stripe returns the user to `/billing` after success or cancellation.
6. The signed webhook updates subscription plan, status, period end, billing interval, Stripe references and payment records.
7. Stripe event processing is transactionally idempotent through advisory locks and audit records.
8. Existing Stripe customers can use Customer Portal for invoices, payment methods and subscription management.

## Backward compatibility

- Existing Free accounts remain active.
- Pricing introduction does not remove existing planner or wedding access.
- Entitlement enforcement is intentionally not introduced in this pricing release.
- Enterprise remains internal and sales-assisted.
- No production database migration is required for the pricing catalog.

## Launch certification still required

- Confirm the Vercel `STRIPE_SECRET_KEY` belongs to the documented connected Stripe account.
- Add the four Price IDs to Vercel Production and Preview environments.
- Create a Stripe webhook endpoint for `https://wewed-nu.vercel.app/api/stripe/webhook`.
- Add the returned signing secret to Vercel as `STRIPE_WEBHOOK_SECRET`.
- Configure Stripe Customer Portal plan-change and cancellation behavior.
- Run one controlled paid subscription test and verify Checkout, webhook, `BusinessAccount`, `PaymentRecord`, audit history, cancellation and refund behavior.

## Regression controls

The Admin Console CI workflow validates:

- canonical plan names and amounts;
- annual discount calculations;
- registration choices sourced from the canonical catalog;
- monthly and annual Checkout metadata;
- environment-variable mappings;
- existing registration, RBAC, data-pipeline, lint and build gates.
