# Wewed Africa-ready UI release

## Release boundary

This branch remains a frontend-only product-experience release. It makes no schema, database, permission, privacy, subscription, billing or API contract changes.

## Original implemented scope

- Zimbabwe-first public acquisition experience.
- Public navigation, information pages and footer.
- Couple command centre.
- Shared public/couple/planner/admin marketplace framing.
- Desktop and mobile Chromium coverage.

## Targeted preview remediation

Following review of the exact-head preview, implementation is limited to the reported visual defects documented in `docs/africa-ready-product-remediation-2026-08-04.md`:

1. remove the reviewed remote landing-page film from the rendered experience and use a local Wewed-owned Black bride-and-groom visual;
2. repair planner marketplace field and empty-state contrast;
3. repair invitation-template and guest-QR dialog containment;
4. repair Daily Planner Operations KPI, tab and panel containment.

This targeted remediation is not a new system-wide redesign and does not authorize unrelated authenticated-page changes.

## Release gate

Do not merge until the exact branch head passes retained migrations, drift, source, build and Chromium gates; retains the planner Task Test 11 priority-filter baseline; and serves a visually reviewed exact-head Vercel preview without runtime errors.

Runtime deployment marker: `africa-ready-targeted-remediation-2026-08-04T13:10Z`
