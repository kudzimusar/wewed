# Wewed.pro Production Domain Migration Plan

**Canonical production origin:** `https://wewed.pro`  
**Repository:** `kudzimusar/wewed`  
**Execution branch:** `feature/wewed-trust-legal-developer`  
**Status:** Execution plan and release contract

## Objective

Transition Wewed's public production identity from Vercel-hosted URLs and legacy Wewed domains to `https://wewed.pro` without breaking internal routing, authentication, guest access, invitations, QR destinations, billing, integrations, SEO, or preview deployments.

The governing rule is:

> `wewed.pro` is Wewed's only public production origin. `*.vercel.app` addresses are deployment infrastructure and must not be emitted as Wewed's public identity.

Internal application links remain relative (for example `/planners` and `/legal/privacy`). Absolute URLs are generated with the canonical origin only where an external or shareable URL is required.

## Phase 1 — Canonical origin source

- Establish one application-level canonical origin constant for `https://wewed.pro`.
- Keep production URL generation independent of generated Vercel deployment hostnames.
- Ensure `NEXT_PUBLIC_SITE_URL`, where consumed, resolves to the canonical origin in production.
- Audit `NEXTAUTH_URL`, `AUTH_URL`, `SITE_URL`, `APP_URL`, `BASE_URL`, `PUBLIC_URL`, `VERCEL_URL`, `NEXT_PUBLIC_VERCEL_URL`, and equivalent variables.
- Production code must fail safely or fall back to `https://wewed.pro`, never to an old public hostname.

## Phase 2 — Repository-wide legacy-domain audit

Search source, configuration, scripts, tests, documentation, seed data, fixtures and workflows for:

- `wewed-nu.vercel.app`
- `wewed-pay-pass-project.vercel.app`
- `wewed-git-main-pay-pass-project.vercel.app`
- hard-coded production `*.vercel.app` URLs
- `wewed.app`
- legacy Wewed HTTP/HTTPS origins
- Vercel environment variables used as public production origins

Historical migration documentation and explicit redirect tests may mention legacy hosts. Product-generated URLs may not.

## Phase 3 — URL generation rules

Relative URLs remain relative for internal navigation. Canonical absolute URLs are used for:

- invitation and guest links;
- RSVP links;
- QR/share destinations;
- transactional communications and Telegram output;
- password reset and authentication callbacks where an absolute URL is required;
- payment success/cancel/return URLs;
- external webhook/callback references;
- canonical metadata, OpenGraph, JSON-LD, sitemap and robots declarations.

## Phase 4 — Vercel production-domain cutover

Target state:

| Host | Required behavior |
| --- | --- |
| `https://wewed.pro` | Canonical production origin |
| `https://www.wewed.pro` | Permanent redirect to apex, if attached |
| legacy public Vercel aliases | Permanent path/query-preserving redirect to `https://wewed.pro` where configuration permits |
| generated preview/deployment hostnames | Remain usable for internal preview/QA and never become canonical metadata |

The custom domain is configured at the Vercel project level, not through the deprecated `alias` field in `vercel.json`.

## Phase 5 — DNS and TLS

Before traffic cutover:

- verify `wewed.pro` is attached to the correct Vercel project;
- verify DNS ownership and resolution;
- verify Vercel TLS certificate issuance;
- verify HTTP redirects to HTTPS;
- verify optional `www` redirect to apex;
- confirm no competing Vercel project owns the domain.

## Phase 6 — Authentication and security boundaries

Audit and test:

- Auth.js/NextAuth production origin and callbacks;
- login, logout, reset and verification redirects;
- invitation authentication;
- cookies, cookie scope and secure flags;
- CSRF/origin checks;
- CORS/trusted-origin lists;
- OAuth provider redirect allow-lists;
- administrator authorization.

The legacy `PATCH /api/privacy` soft cookie gate is a production blocker and must be replaced with authoritative server-side authorization or made non-writable in production.

## Phase 7 — Invitations, guests and QR/share links

Verify all newly generated public links use `https://wewed.pro`, including:

- invitation links;
- guest-access and RSVP URLs;
- QR destinations;
- planner/vendor public sharing;
- Telegram and notification links.

Existing printed QR codes or externally shared legacy links require compatibility redirects rather than relying solely on database mutation.

## Phase 8 — Billing and external integrations

Audit Stripe and all connected integrations for production origins, callback URLs and redirects.

At minimum review:

- Stripe checkout success/cancel URLs and portal return URLs;
- Stripe webhooks/external configuration;
- Telegram-generated links;
- Google/Google Sheets OAuth redirects;
- Supabase authentication site/redirect configuration where used;
- AI/integration output that can include Wewed links.

Do not invent or expose unsupported integration configuration.

## Phase 9 — SEO and public identity

Verify or implement:

- `metadataBase = https://wewed.pro`;
- route-appropriate canonical URLs;
- route-appropriate OpenGraph URLs;
- sitemap with `https://wewed.pro` URLs;
- robots configuration referencing the canonical sitemap;
- JSON-LD and Organization/WebSite URL consistency;
- manifest and social assets with correct origin behavior.

Public metadata must not overstate product capabilities such as universal provider verification.

## Phase 10 — Trust/content alignment

Before release, correct public statements that do not match current product behavior:

- marketplace ranking explanation must reflect the implemented ranking order;
- review documentation must distinguish governing policy from unavailable review workflows;
- verification language must describe only checks actually performed;
- subprocessor/user-enabled integration disclosures must reflect the deployed stack;
- report/contact pages must not send users into circular guidance or claim a channel that does not exist.

Known legal particulars that are not established in the repository must not be fabricated.

## Phase 11 — Permanent regression guard

Add an automated domain guard that fails CI when production source introduces prohibited legacy production origins.

Allowed exceptions are limited to:

- this migration record;
- explicit legacy-host redirect configuration;
- tests asserting those redirects;
- historical fixtures where the legacy hostname itself is the subject of the test.

The guard must not reject Vercel preview infrastructure merely because a deployment receives a generated hostname.

## Phase 12 — Playwright/Chromium release verification

Run existing and migration-specific Playwright tests with Chromium. Verify at minimum:

- homepage and primary public navigation;
- planners and vendors marketplace entry routes;
- Company, Trust, Legal, Vendor Resources, Developers and Help hubs;
- representative detail pages from every public center;
- sign-in, registration and password-reset entry routes;
- guest-access help;
- redirect behavior for configured legacy host handling;
- canonical/metadata behavior where testable;
- absence of unexpected 404/5xx responses.

Authenticated browser suites already in the repository remain release gates and must be preserved.

## Phase 13 — CI, deployment and production smoke verification

Execution order:

1. Implement and review migration changes on the feature branch.
2. Run repository CI, unit/integration checks and Chromium browser gates.
3. Self-correct migration-caused regressions until required checks pass.
4. Deploy a Vercel preview and verify it does not advertise its preview hostname as canonical.
5. Attach/verify `wewed.pro` on the Vercel project when supported by connected tooling.
6. Verify DNS/TLS and external provider callback allow-lists.
7. Promote/deploy production.
8. Verify `https://wewed.pro` route matrix and redirects.
9. Inspect Vercel runtime errors/logs for domain, auth, callback and 4xx/5xx regressions.

If connected tooling cannot mutate a provider setting, record the exact limitation and do not falsely mark that step complete.

## Rollback criteria

Rollback or withhold production promotion if any of the following occurs:

- authentication or invitation access breaks;
- billing callbacks return to a non-canonical host;
- public routes produce redirect loops or widespread 404/5xx responses;
- canonical metadata points at a preview/legacy hostname;
- administrator authorization is weakened;
- required CI/Chromium release gates fail because of migration changes;
- `wewed.pro` does not have valid DNS/TLS to the intended Vercel project.

## Definition of done

The migration is complete only when:

- `https://wewed.pro` is verified as Wewed's canonical production origin;
- no Wewed-generated public link uses `wewed.app` or a Vercel deployment hostname as its production identity;
- invitation, guest, RSVP, QR/share, authentication and billing URL generation is canonical;
- Telegram and other user-facing integrations emit `wewed.pro` links;
- SEO canonicals, OpenGraph, sitemap and robots use `wewed.pro` appropriately;
- the legacy privacy write authorization blocker is fixed;
- public trust/marketplace wording matches current product behavior;
- the domain regression guard passes;
- required CI passes;
- Playwright Chromium route and regression tests pass;
- production smoke checks pass on `https://wewed.pro`;
- Vercel production runtime errors show no migration-related blocker.
