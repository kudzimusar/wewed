from pathlib import Path


def replace_exact(path: str, old: str, new: str, expected: int = 1):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} matches, found {count}: {old[:100]}')
    p.write_text(text.replace(old, new, expected))

plan = 'docs/AI_WEDDING_ARCHITECT_ECOSYSTEM_PLAN.md'
test = 'src/lib/wedding-architect-ecosystem-contract.test.ts'

replace_exact(
    plan,
    'Status: **Approved direction; implementation proceeds incrementally on `feature/ai-wedding-architect`.**',
    'Status: **Phases A–C implemented; Phase D is partially delivered through deterministic optimisation, read-only plan preview and private AI explanation. Later persistence, editing, print/export, introductions, quotes, bookings and monetisation remain governed future phases.**',
)

old_phase = '''### Phase C — Pricing and eligibility — PARTIAL / FAIL-CLOSED

- [x] Deterministic pricing library with category fixtures.
- [x] Price provenance/versioning primitives in deterministic calculation results.
- [x] Eligibility filter and explicit rejection reasons as a deterministic library.
- [ ] Canonical marketplace candidate adapter resolving live provider/account/subscription/availability data.
- [ ] End-to-end subscription entitlement integration into Wedding Architect candidate selection.
- [ ] Category-semantic approval for ambiguous variable quantity bindings.

Release boundary: Phase C libraries are present for controlled development and testing, but the production-facing Wedding Architect does not yet auto-select or optimise real providers. Ambiguous variable units are stored but fail AI Planning Readiness for automatic selection until their category semantics are explicitly approved.

### Phase D — Optimisation and Wedding Plan

- [ ] Plan optimisation service.
- [ ] Value/balanced/priority-led scenarios.
- [ ] Structured plan persistence/versioning.
- [ ] Editable plan UI.
- [ ] Print/PDF rendering from structured plan.
- [ ] AI explanations and plan conversation.
'''
new_phase = '''### Phase C — Pricing and eligibility — COMPLETE

- [x] Deterministic pricing library with category fixtures.
- [x] Price provenance/versioning primitives in deterministic calculation results.
- [x] Eligibility filter and explicit rejection reasons as a deterministic library.
- [x] Canonical marketplace candidate adapter resolving live provider, account, billing, catalogue and requirement data.
- [x] End-to-end provider and planner subscription entitlement integration.
- [x] Category-semantic approval for variable quantity bindings, including compound quantities such as rooms × nights and guards × hours.
- [x] Package quantity type/source/multiplier data aligned across database, API, provider form and optimiser.
- [x] Exact-package base-price semantics: variable free-text package units cannot be treated as a fixed total.
- [x] Travel pricing fails closed when exact route distance is unavailable; AI never estimates kilometres for commercial arithmetic.
- [x] Provider availability remains explicitly unconfirmed where no canonical availability record exists.

Release boundary: Phase C may automatically evaluate and rank only providers that pass the governed paid entitlement, listing, commercial-readiness, category, currency, service-area, capacity, requirement-fit and exact-pricing rules. A missing or uncertain commercial fact removes the candidate from exact-budget selection or surfaces a warning; it never becomes an AI guess. No provider is contacted by Phase C.

### Phase D — Optimisation and Wedding Plan — PARTIAL

- [x] Hard-budget deterministic plan optimisation service.
- [x] Value/balanced/priority-led scenarios.
- [x] Read-only Wedding Architect plan preview embedded in the shared Wedding Brief.
- [x] Private AI explanation of the authoritative server-calculated plan.
- [ ] Structured plan persistence/versioning.
- [ ] Editable/lockable plan-line workflow and recalculation.
- [ ] Print/PDF rendering from structured persisted plan.
- [ ] Multi-turn plan conversation over persisted plan revisions.
'''
replace_exact(plan, old_phase, new_phase)

old_status = '''## 23. Current implementation status

Phases A and B are implemented on the Wedding Architect feature branch. Phase C has deterministic pricing, provenance primitives, eligibility rules and quantity-binding infrastructure, but live marketplace candidate selection, subscription integration and category-semantic approval remain intentionally incomplete.

The release therefore fails closed: no production-facing optimiser or automatic provider recommendation is exposed from partial Phase C work. The shared provider catalogue and Wedding Brief may be tested and merged only after the exact-head regression gates, Preview deployment and UAT pass. Later optimiser work must consume the same canonical records rather than creating a parallel AI data model.'''
new_status = '''## 23. Current implementation status

Phases A, B and C are implemented. Wewed now has one canonical provider commercial catalogue, one shared Wedding Brief, governed commercial entitlements, deterministic provider eligibility and fit scoring, exact client-specific candidate pricing, and a hard-budget optimiser. The Wedding Brief contains a read-only Wedding Architect plan preview and private AI explanation that rebuilds and explains the authoritative server-calculated result.

The completed Phase C release remains deliberately fail-closed. `from`/range lower bounds are not final prices; variable package units are not guessed; ambiguous quantity bindings are not executable; kilometre travel fees require known route distance; unknown provider availability stays unconfirmed; free or non-entitled providers remain ordinary marketplace listings rather than AI-originated commercial recommendations; and no provider enquiry, booking, payment or contact event is created by plan generation.

Phase D is partially delivered through optimisation, preview and AI explanation. The next coherent implementation slice is structured plan persistence/versioning, editable and lockable plan lines, deterministic recalculation, and print/PDF output from the same persisted plan. Only after explicit user approval should Phase E create internal opportunities and provider communications.'''
replace_exact(plan, old_status, new_status)

replace_exact(test, "expect(plan).toContain('Phase C — Pricing and eligibility — PARTIAL / FAIL-CLOSED')", "expect(plan).toContain('Phase C — Pricing and eligibility — COMPLETE')")
replace_exact(test, "expect(plan).toContain('no production-facing optimiser or automatic provider recommendation is exposed')", "expect(plan).toContain('No provider is contacted by Phase C')")
replace_exact(test, "expect(plan).toContain('Canonical marketplace candidate adapter')", "expect(plan).toContain('Canonical marketplace candidate adapter resolving live provider, account, billing, catalogue and requirement data')")
replace_exact(test, "expect(plan).toContain('End-to-end subscription entitlement integration')", "expect(plan).toContain('End-to-end provider and planner subscription entitlement integration')")

print('Phase C documentation and ecosystem contract status updated.')
