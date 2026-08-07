# Wewed Policy & Trust Matrix

**Canonical domain:** `https://wewed.pro`  
**Baseline date:** 2026-08-07  
**Purpose:** keep public promises, legal terms and product safeguards aligned as Wewed evolves.

## How to use this matrix

Every material feature should be reviewed across the same chain:

`feature → data touched → participants → risk → policy → product safeguard → public explanation`

A published policy is **not** evidence that the corresponding technical safeguard exists. The status column below distinguishes controls verified from the current repository/data model from controls that need continued product verification or implementation.

| Capability | Data touched | Participants | Main risks | Governing public docs | Product safeguard / requirement | Public explanation | Status |
|---|---|---|---|---|---|---|---|
| Accounts & authentication | Email, name, password hash/auth state, login activity | All account holders | Account takeover, impersonation, stale access | Terms, Privacy, Acceptable Use, Security | Authentication, secure credentials, active/disabled state, session controls | Security at Wewed | **Current model verified**; continue security testing |
| Wedding workspaces | Couple identity, wedding date, venue, lifecycle, privacy state, content | Couples, planners, collaborators | Oversharing, cross-wedding access, accidental publication | Terms, Privacy, Privacy at Wewed | Wedding-scoped authorization and privacy controls | Privacy at Wewed | **Current model verified**; UI/route enforcement must remain tested |
| Planner tasks | Titles, descriptions, status, priority, due dates, assignees | Planners, authorized collaborators | Unauthorized edits, missed deadlines, attribution disputes | Terms, Privacy | Wedding scoping, assignee authorization, auditability | Trust at Wewed | **Current model verified**; UAT also covers priority filtering/status persistence |
| Planner membership & permissions | User IDs, wedding IDs, roles, status, permission payload, inviter | Planners, couples, teams | Excess privilege, former staff access | Privacy, Security | Least privilege, invitation/acceptance/revocation, permission checks | Security at Wewed | **Current model verified**; permission semantics need continuous route tests |
| Guests & RSVP | Names, email, phone, seating, attendance, meals, dietary notes, plus-ones, messages | Couples, planners, guests | Non-user privacy, sensitive preference exposure, unwanted marketing | Privacy, Vendor Terms, Communications | Purpose-limited access, wedding scoping, token security, minimal vendor disclosure | Privacy at Wewed | **Current model verified**; retention/export/delete flows need explicit UX validation |
| Wedding website/privacy | Date, venue, city/country, media, programme, guest-facing content | Couples, planners, guests/public depending setting | Location/schedule exposure, indexing, unauthorized access | Privacy, Terms, Privacy at Wewed | Privacy state must be enforced consistently; invitation/token controls where used | Privacy at Wewed | **Privacy field exists**; every public route must be tested against it |
| Media & guest contributions | Photos, captions, uploader identity, memories, relationship, privacy/status | Couples, planners, guests | Copyright, privacy, unwanted publication | IP Policy, Content Policy, Privacy | Upload authorization, moderation/status, privacy enforcement | Content/IP and Privacy | **Current model verified**; takedown workflow should be operationalized |
| Messages & comments | Message/comment text, author identity, moderation flags | Couples, guests, planners, authorized users | Harassment, defamation, privacy leakage | Content Policy, Acceptable Use, Reporting | Moderation/flag/hide controls, wedding scoping | Reporting & Enforcement | **Current model verified**; moderation operations require UAT |
| Vendors in wedding planning | Business/contact data, contract/payment status, ratings, notes | Couples, planners, vendors | Misrepresentation, private notes exposure, contractual confusion | Marketplace, Vendor Terms, Privacy | Wedding scoping, clear provider role, controlled access to notes/status | Marketplace Safety | **Current model verified**; do not imply Wewed guarantees performance |
| Public provider marketplace | Profile/listing/business data, ranking/featured signals | Couples, planners, providers | Fake providers, misleading listings, paid-placement opacity | Marketplace, Vendor Terms, Ranking Transparency | Defined verification criteria, sponsored disclosure when payment affects ranking | Verification; Ranking & Sponsorship | **Public routes exist**; verification/ranking claims require feature-specific validation |
| Reviews/ratings | Rating/review content, reviewer-provider relationship evidence | Customers, providers | Fake reviews, retaliation, pay-to-play removal | Review Policy, Content Policy | Evidence rules, conflict handling, anti-manipulation, neutral moderation | Review Integrity | **Policy baseline published**; only display “verified” when product can prove the check |
| Budgets & financial planning | Estimated/actual costs, paid amount, currency, vendor references, due dates | Couples, planners | Financial privacy, mistaken totals, AI reliance | Terms, Privacy, AI Policy | Wedding scoping, clear calculation behavior, human confirmation | Trust/AI transparency | **Current model verified** |
| Wewed subscription billing | Account/subscription metadata, checkout/billing IDs handled by processor | Paying account holders, Wewed, Stripe | Renewal/refund disputes, payment security | Payments & Refunds, Privacy, Terms | Stripe-hosted/processor controls, clear plan/renewal/cancellation UX | Payments policy | **Stripe Billing verified in current billing route** |
| Independent vendor payments/contracts | Contract/payment planning status and possibly external transaction details | Couple/planner/vendor | Users assuming Wewed is merchant/guarantor | Marketplace, Payments, Terms | UI must distinguish Wewed fees from vendor obligations | Marketplace Safety | **Boundary documented**; no protection/insurance promise without a real program |
| Imports/templates | Uploaded file names/content, mappings, preview/rollback data, template content | Planners/couples | Accidental overwrite, sensitive spreadsheet data, cross-wedding import | Privacy, Terms | Preview, validation, rollback, wedding scoping | Help/trust guidance | **Import model verified**; route behavior should remain tested |
| Google Sheets integration | Spreadsheet IDs/names, access/refresh tokens, sync state | Authorized wedding users, Google | Token leakage, excessive scopes, stale access | Privacy, Developer Terms, Security | Encrypt/protect tokens, least privilege, revoke/disconnect, audit sync errors | Developer Security | **Current model verified**; token-at-rest handling must be security-reviewed |
| Audit trail | Actor, action, resource, before/after values, IP/user agent | Admins/authorized operators | Excessive logging, sensitive data in logs | Privacy, Security | Restricted access, retention policy, avoid unnecessary secrets | Security at Wewed | **Current model verified** |
| AI assistance | Prompts, output, relevant workspace/document context, rate-limit identifiers | Authorized Wewed users, configured AI providers | Hallucination, data transfer, hidden consequential action | AI Transparency, Privacy, Terms | Explicit invocation, context minimization, rate limits, user confirmation for consequential actions | AI policy | **Groq/Gemini/Z.ai integration code verified** |
| Admin/support | Account, moderation, wedding and operational data | Authorized Wewed staff | Insider access, overreach, accidental changes | Privacy, Security, Reporting | RBAC, audit events, least privilege, documented support procedures | Security/Reporting | **Admin surface exists**; operational access policy still needs owner assignment |
| Cookies/browser storage | Sessions, preferences, local state, analytics if enabled | Visitors/users | Tracking without consent, stale local data | Cookie Policy, Privacy | Classify essential vs optional; consent before legally required optional trackers | Cookie Policy | **Policy published**; production tracker inventory must be maintained |
| Internal application APIs | User/wedding/resource data | Wewed frontend/backend | Undocumented exposure, auth bypass, external dependence on unstable routes | Developer Terms, Security | Authz on every route, rate limiting where appropriate, no implied public API | Developer Overview | **Internal API exists; public API is not announced** |
| Future public API/webhooks | Scoped platform resources and event payloads | Approved third-party developers | Credential theft, data extraction, breaking changes, duplicate webhook actions | Developer Terms and Center | OAuth/API keys, scopes, signatures, rate limits, idempotency, versioning | Developer Center | **Readiness contract only; not generally available** |
| Data export/deletion | Wedding/account records across modules | Data subjects, account owners | Incomplete deletion, loss of records, unauthorized export | Privacy, DPA | Identity verification, scoped export, retention exceptions, audit event | Privacy at Wewed | **Policy requirement**; end-to-end UX/control should be verified before marketing as one-click portability |
| Accessibility | Public and authenticated UI | All users | Exclusion, keyboard/screen-reader barriers | Accessibility Statement | WCAG 2.2 AA working target, testing and remediation | Accessibility | **Commitment published; no claim of completed independent conformance audit** |

## Policy-to-product release gate

Before releasing or materially changing a Wewed feature, answer all of the following:

1. What personal, wedding, business or financial data does it add or expose?
2. Which roles can read, create, edit, export and delete it?
3. Does it introduce a new third party or subprocessor?
4. Can a user reasonably mistake Wewed for the contracting service provider, merchant, verifier or insurer?
5. Does it alter public/private visibility or search-engine exposure?
6. Does it add AI inference, automated decision-making or consequential automation?
7. Does it introduce a payment, subscription, refund or cancellation promise?
8. Does it change rankings, sponsorship, reviews or verification badges?
9. Do the Terms, Privacy Policy, subprocessor notice, Trust Center or Developer Center need an effective-date update?
10. What automated/UAT test proves the promised safeguard actually works?

## Ownership rule

Policy text, product behavior and support operations must move together. If the product cannot currently support a public promise, change the promise or implement the safeguard before release. Never use legal text as a substitute for access control, auditability, secure defaults or fair marketplace operations.
