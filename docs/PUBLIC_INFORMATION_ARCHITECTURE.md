# Wewed Public Information Architecture

**Canonical domain:** `https://wewed.pro`  
**Implementation baseline:** 2026-08-07  
**Purpose:** keep the public trust, company, legal, professional, developer and help structure explicit as the product grows.

## Public structure

```text
WEWED
│
├── Company                         /company
│   ├── About                       /company/about
│   ├── How Wewed Works             /company/how-wewed-works
│   ├── Contact                     /company/contact
│   └── Careers                     /company/careers
│
├── Trust & Safety                  /trust
│   ├── Trust at Wewed              /trust/trust-at-wewed
│   ├── Vendor Verification         /trust/vendor-verification
│   ├── Review Integrity            /trust/review-integrity
│   ├── Wedding Safety              /trust/wedding-safety
│   ├── Scam Prevention             /trust/scam-prevention
│   ├── Report a Problem            /trust/report-a-problem
│   ├── Non-Discrimination          /trust/non-discrimination
│   ├── Accessibility               /trust/accessibility
│   └── Security                    /trust/security
│
├── Legal                           /legal
│   ├── Terms of Service            /legal/terms
│   ├── Privacy Policy              /legal/privacy
│   ├── Cookie Policy               /legal/cookies
│   ├── Marketplace Terms           /legal/marketplace
│   ├── Vendor Terms                /legal/vendor-terms
│   ├── Payment & Refund Terms      /legal/payments-refunds
│   ├── Acceptable Use              /legal/acceptable-use
│   ├── Content Policy              /legal/content-community
│   ├── Review Policy               /legal/reviews
│   ├── Copyright / IP Policy       /legal/intellectual-property
│   ├── AI Policy                   /legal/ai-transparency
│   └── Data Processing Addendum    /legal/data-processing
│
├── Vendors                         /vendors/resources
│   ├── Vendor Standards            /vendors/resources/vendor-standards
│   ├── How Ranking Works           /vendors/resources/how-ranking-works
│   ├── Verification                /vendors/resources/verification
│   ├── Reviews                     /vendors/resources/reviews
│   └── Vendor Help                 /vendors/resources/vendor-help
│
├── Developers                      /developers
│   ├── Overview                    /developers/overview
│   ├── Quickstart                  /developers/quickstart
│   ├── API Reference               /developers/api-reference
│   ├── Authentication              /developers/authentication
│   ├── Webhooks                    /developers/webhooks
│   ├── Errors                      /developers/errors
│   ├── Rate Limits                 /developers/rate-limits
│   ├── Versioning                  /developers/versioning
│   ├── Changelog                   /developers/changelog
│   ├── API Status                  /developers/api-status
│   └── Developer Terms             /developers/developer-terms
│
└── Help                            /help
    ├── Couples                     /help/couples
    ├── Planners                    /help/planners
    ├── Vendors                     /help/vendors
    └── Guests                      /help/guests
```

## Routing decision for Vendors

`/vendors` already serves the live provider marketplace. It must not be replaced by documentation because doing so would break an existing public product surface. The documentation branch therefore uses `/vendors/resources` while the footer still presents the information architecture under the user-facing heading **Vendors**.

## Developer boundary

The Developer Center is a real public documentation structure, but it does **not** claim that Wewed currently has a generally available public API. Internal application routes remain undocumented implementation details. API Reference, Quickstart, Rate Limits, API Status and related pages define the contract Wewed will meet before supported third-party production access is announced.

## Legal boundary

The Legal Center contains additional supporting documents beyond the minimum navigation tree, including Electronic Communications, Non-Discrimination, Developer/API Terms and the Subprocessor notice. These remain useful incorporated policies even when the primary footer hierarchy surfaces the shorter set above.

## Discoverability requirement

Every public center must be reachable from the global public shell. The footer exposes the complete six-branch hierarchy, and mobile navigation exposes all six centers. Product routes such as the vendor marketplace, planner discovery, registration, sign-in and guest access remain available separately.

## Maintenance rule

When a public route, product capability or legal commitment changes:

1. update the relevant public document;
2. update `docs/POLICY_TRUST_MATRIX.md` if the risk/control mapping changes;
3. update this information architecture if a route or public section changes;
4. update the effective date for legal documents when the legal commitment materially changes;
5. verify footer/navigation links and build output before release;
6. do not publish a verification, security, insurance, API or compliance claim that the product cannot substantiate.
