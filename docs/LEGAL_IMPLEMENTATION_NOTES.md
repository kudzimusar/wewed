# Wewed Legal & Trust Implementation Notes

**Canonical public domain:** `https://wewed.pro`  
**Public policy baseline:** August 7, 2026

This file is an internal implementation record. It is not a public policy and is not legal advice.

## What this release intentionally does

- Establishes `wewed.pro` as the canonical domain in application metadata.
- Adds a public Legal Center, Trust & Safety Center and Developer Center.
- Publishes modular policies rather than one monolithic agreement.
- Separates Wewed subscription billing from independent wedding-provider contracts.
- Documents current AI-provider capability without promising model accuracy.
- States that internal application endpoints are not a generally available public API.
- Establishes specific verification/review principles without claiming checks that are not proven by the product.
- Sets WCAG 2.2 AA as a working accessibility target without claiming an independent conformance audit.
- Creates `docs/POLICY_TRUST_MATRIX.md` as the release governance artifact.

## Facts deliberately not invented

The repository does not establish the following legal particulars, so the public documents do not fabricate them:

1. Registered legal entity name for the Wewed operator.
2. Company/registration number.
3. Registered business address.
4. Governing-law jurisdiction and exclusive dispute forum.
5. Dedicated legal, privacy, DPO or security email addresses.
6. Tax/VAT registration particulars.
7. Formal insurance or customer reimbursement/guarantee program.
8. Security certifications such as SOC 2 or ISO 27001.
9. Completed WCAG conformance audit.
10. A generally available public API or SLA.

These items should be added only after the underlying fact is confirmed.

## Counsel completion checklist

Before relying on the public legal pages as the final jurisdiction-specific contract, qualified counsel should confirm:

- Operator identity and statutory business disclosures.
- Governing law, venue, dispute process and any arbitration/class-action language appropriate to launch markets.
- Consumer cancellation/refund rules for Wewed subscriptions.
- Privacy-law roles and notices for the countries where users are offered the service.
- Cross-border transfer mechanisms and customer-specific DPA annexes where required.
- Cookie/consent requirements based on the actual production analytics and advertising stack.
- Electronic marketing/SMS consent requirements.
- Marketplace/intermediary obligations and any local wedding-provider verification duties.
- Review moderation and consumer-review regulations.
- Copyright/takedown procedure and statutory agent/contact requirements where applicable.
- Accessibility obligations applicable to the service and markets.
- Children/minor data handling, particularly guest records and wedding contributions.
- Record-retention rules for invoices, disputes, fraud and account deletion.

## Product controls that must remain synchronized with policy

### Privacy and guest data

The Prisma model includes guest name, email, phone, RSVP, meal, dietary, seating and plus-one information. Any feature that exposes guest data to planners, vendors, collaborators or public pages must enforce the wedding membership/privacy boundary and purpose limitation described publicly.

### Wedding privacy

The `Wedding` model contains a `privacy` field. Public routes must consistently honor it. A policy statement that Wewed is privacy-led is not sufficient if a route can bypass the privacy state.

### Membership and permissions

`WeddingMembership` supports roles, status, permissions, accepted/revoked states. Every protected feature should derive access from authoritative membership/role checks rather than relying only on hidden navigation.

### Auditability

`AuditEvent` can capture actors and before/after values. Logging should avoid credentials, tokens and unnecessary sensitive content. Audit access itself must be restricted.

### Billing

The billing route explicitly uses Stripe Billing. Keep Wewed subscription/refund language separate from vendor deposits and wedding-service contracts unless a future product deliberately makes Wewed the merchant or contracting party.

### AI

The current AI configuration supports Groq, Google Gemini and Z.ai and permits provider selection/fallback. Any production change to AI providers, prompt retention, data-use terms or high-impact automation requires review of the Privacy Policy, AI Transparency Policy and subprocessor notice.

### Google Sheets

The data model includes access and refresh tokens for Google Sheets connections. Token storage, encryption, scope minimization, revocation and log redaction require dedicated security review.

### Reviews and verification

Do not display a generic “Verified” badge unless the exact underlying check is defined and implemented. Do not call a review “Verified Client Review” unless Wewed can substantiate a qualifying relationship. Paid status must never be a hidden review-removal criterion.

### Sponsored ranking

If future monetization affects vendor/planner placement, mark the placement as sponsored/promoted and update the Ranking & Sponsorship explanation to reflect the real ranking system.

### Data export/deletion

Do not market one-click portability or complete deletion until the workflow has been tested across wedding records, guests, media, audit/legal retention and connected systems.

## Documentation maintenance rule

When a material feature changes, the pull request should include one of these statements:

- `Policy impact: none` with a short reason; or
- `Policy impact: updated` and links to the affected public document(s) and matrix row(s).

A new vendor/subprocessor, public data surface, AI provider, payment behavior, verification badge, ranking signal, API contract or account role should always trigger explicit policy-impact review.
