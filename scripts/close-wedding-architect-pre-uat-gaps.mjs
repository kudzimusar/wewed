import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(path, before, after, label) {
  const source = readFileSync(path, 'utf8')
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`)
  writeFileSync(path, source.replace(before, after))
}

const route = 'src/app/api/providers/profile/route.ts'
replaceOnce(
  route,
  "import { defaultPriceBinding, providerPriceBindingOptions } from '@/lib/provider-price-bindings'",
  "import {\n  defaultPriceBinding,\n  priceComponentsUseCanonicalAutomaticBindings,\n  providerPriceBindingOptions,\n} from '@/lib/provider-price-bindings'",
  'provider binding import',
)

replaceOnce(
  route,
  `        const priceComponents = normalizePriceComponents(input.priceComponents, category)\n        const priceValidFrom = dateValue(input.priceValidFrom, 'Price valid from')`,
  `        const priceComponents = normalizePriceComponents(input.priceComponents, category)\n        const packages = Array.isArray(input.packages) ? input.packages.slice(0, 20).map(jsonObject) : []\n        const allPriceComponents = [\n          ...priceComponents,\n          ...packages.flatMap((packageInput) =>\n            Array.isArray(packageInput.priceComponents) ? packageInput.priceComponents : [],\n          ),\n        ]\n        const automaticQuantityBindingsApproved =\n          priceComponentsUseCanonicalAutomaticBindings(allPriceComponents)\n        const priceValidFrom = dateValue(input.priceValidFrom, 'Price valid from')`,
  'provider binding readiness inputs',
)

replaceOnce(
  route,
  `          packages: Array.isArray(input.packages) ? input.packages.slice(0, 20).map(jsonObject) : [],`,
  `          packages,`,
  'normalized offering packages',
)

replaceOnce(
  route,
  `        const readiness = calculateCommercialReadiness({\n          ...offering,\n          serviceAreas: offering.serviceAreas,\n          packages: offering.packages,\n          commercialConfirmed,\n        })`,
  `        const readiness = calculateCommercialReadiness({\n          ...offering,\n          serviceAreas: offering.serviceAreas,\n          packages: offering.packages,\n          priceComponents: allPriceComponents,\n          automaticQuantityBindingsApproved,\n          commercialConfirmed,\n        })`,
  'provider readiness calculation',
)

const plan = 'docs/AI_WEDDING_ARCHITECT_ECOSYSTEM_PLAN.md'
replaceOnce(
  plan,
  `### Phase A — Data contract and provider catalogue readiness\n\n- [ ] Add structured commercial fields and calculation components.\n- [ ] Extend package model.\n- [ ] Add AI planning readiness/completeness calculation.\n- [ ] Upgrade category forms and validation.\n- [ ] Preserve public provider and marketplace compatibility.\n\n### Phase B — Client requirements\n\n- [ ] Canonical wedding requirements model.\n- [ ] Couple/planner shared requirement UI.\n- [ ] Category-specific questions and priority levels.\n- [ ] AI-assisted conversational requirement completion.\n\n### Phase C — Pricing and eligibility\n\n- [ ] Deterministic pricing library with category fixtures.\n- [ ] Price provenance/versioning.\n- [ ] Eligibility filter and explicit rejection reasons.\n- [ ] Subscription entitlement integration.`,
  `### Phase A — Data contract and provider catalogue readiness — COMPLETE\n\n- [x] Add structured commercial fields and calculation components.\n- [x] Extend package model.\n- [x] Add AI planning readiness/completeness calculation.\n- [x] Upgrade category forms and validation.\n- [x] Preserve public provider and marketplace compatibility.\n\n### Phase B — Client requirements — COMPLETE\n\n- [x] Canonical wedding requirements model.\n- [x] Couple/planner shared requirement UI.\n- [x] Category-specific questions and priority levels.\n- [x] AI-assisted conversational requirement completion.\n\n### Phase C — Pricing and eligibility — PARTIAL / FAIL-CLOSED\n\n- [x] Deterministic pricing library with category fixtures.\n- [x] Price provenance/versioning primitives in deterministic calculation results.\n- [x] Eligibility filter and explicit rejection reasons as a deterministic library.\n- [ ] Canonical marketplace candidate adapter resolving live provider/account/subscription/availability data.\n- [ ] End-to-end subscription entitlement integration into Wedding Architect candidate selection.\n- [ ] Category-semantic approval for ambiguous variable quantity bindings.\n\nRelease boundary: Phase C libraries are present for controlled development and testing, but the production-facing Wedding Architect does not yet auto-select or optimise real providers. Ambiguous variable units are stored but fail AI Planning Readiness for automatic selection until their category semantics are explicitly approved.`,
  'delivery phase status',
)

replaceOnce(
  plan,
  `## 23. Initial implementation decision\n\nImplementation starts with **Phase A: canonical provider commercial data and AI Planning Readiness**, because the Wedding Architect must not optimise against ambiguous or invented prices.\n\nThe first deliverable is complete only when the database, provider APIs, provider forms and regression tests agree on the same commercial contract. The optimiser and user-facing Wedding Architect must not be built on top of a partially implemented catalogue contract.`,
  `## 23. Current implementation status\n\nPhases A and B are implemented on the Wedding Architect feature branch. Phase C has deterministic pricing, provenance primitives, eligibility rules and quantity-binding infrastructure, but live marketplace candidate selection, subscription integration and category-semantic approval remain intentionally incomplete.\n\nThe release therefore fails closed: no production-facing optimiser or automatic provider recommendation is exposed from partial Phase C work. The shared provider catalogue and Wedding Brief may be tested and merged only after the exact-head regression gates, Preview deployment and UAT pass. Later optimiser work must consume the same canonical records rather than creating a parallel AI data model.`,
  'current implementation status',
)

console.log('Pre-UAT gap patches applied cleanly.')
// trigger: 2026-08-07 pre-UAT audit
