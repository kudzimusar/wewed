from pathlib import Path


def patch(path: str, old: str, new: str, expected: int = 1):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} matches, found {count}: {old[:120]}')
    p.write_text(text.replace(old, new, expected))

route = 'src/app/api/providers/profile/route.ts'
market = 'src/lib/wedding-architect-marketplace.ts'
manager = 'src/components/providers/provider-profile-manager.tsx'

patch(route,
"""import {
  isApprovedAutomaticPriceBinding,
  priceComponentsUseApprovedAutomaticBindings,
} from '@/lib/wedding-architect-binding-policy'
""",
"""import {
  isApprovedAutomaticPriceBinding,
  isAutomaticExactPackageBasePrice,
  priceComponentsUseApprovedAutomaticBindings,
} from '@/lib/wedding-architect-binding-policy'
""")

patch(route,
"""        const packageQuantityBindingsApproved = packages.every((packageInput) => {
          if (packageInput.additionalUnitPrice === null || packageInput.additionalUnitPrice === undefined || packageInput.additionalUnitPrice === '') return true
""",
"""        const automaticPackageBasePricesApproved = packages.every((packageInput) => {
          if (packageInput.price === null || packageInput.price === undefined || packageInput.price === '') return true
          return isAutomaticExactPackageBasePrice(packageInput.pricingUnit)
        })
        const packageQuantityBindingsApproved = packages.every((packageInput) => {
          if (packageInput.additionalUnitPrice === null || packageInput.additionalUnitPrice === undefined || packageInput.additionalUnitPrice === '') return true
""")

patch(route,
"""          automaticQuantityBindingsApproved,
          commercialConfirmed,
""",
"""          automaticQuantityBindingsApproved,
          automaticPackageBasePricesApproved,
          commercialConfirmed,
""")

patch(market,
"import { isApprovedAutomaticPriceBinding, priceComponentsUseApprovedAutomaticBindings } from '@/lib/wedding-architect-binding-policy'",
"import { isApprovedAutomaticPriceBinding, isAutomaticExactPackageBasePrice, priceComponentsUseApprovedAutomaticBindings } from '@/lib/wedding-architect-binding-policy'",
)

patch(market,
"""  priceCents: number
  currency: string
  isActive: boolean
""",
"""  priceCents: number
  currency: string
  pricingUnit: string | null
  isActive: boolean
""")

patch(market,
"""    automaticQuantityBindingsApproved:
      priceComponentsUseApprovedAutomaticBindings(row.category, allComponents) &&
      packages.every((pkg) => {
""",
"""    automaticQuantityBindingsApproved:
      priceComponentsUseApprovedAutomaticBindings(row.category, allComponents) &&
      packages.every((pkg) => {
""")
# Add base-price approval immediately after automatic binding block.
patch(market,
"""        })
      }),
  }, now)
}
""",
"""        })
      }),
    automaticPackageBasePricesApproved: packages.every((pkg) => isAutomaticExactPackageBasePrice(pkg.pricingUnit)),
  }, now)
}
""", expected=1)

patch(market,
"""    `SELECT id, \"offeringId\", name, \"priceCents\", currency, \"isActive\",
""",
"""    `SELECT id, \"offeringId\", name, \"priceCents\", currency, \"pricingUnit\", \"isActive\",
""")

# Unknown routing distance stays unknown until Wewed has geocoded provider-to-event distance.
patch(market,
"""function normalizedLocation(value: string | null | undefined): string {
  return String(value ?? '').trim().toLowerCase()
}

function quantityContext(profile: RequirementProfileRow, category: CategoryRequirementRow, provider: OfferingRow): PriceQuantityContext {
  const sameCountry = normalizedLocation(provider.providerCountry) === normalizedLocation(profile.country)
  const sameCity = normalizedLocation(provider.providerCity) === normalizedLocation(profile.city)
  return {
    guestCount: profile.guestCount,
    adultCount: profile.adultCount,
    childCount: profile.childCount,
    // We can prove zero inter-city travel only when both canonical locations match.
    // Any other distance remains unknown until Wewed has geocoded routing data.
    travelKm: sameCountry && sameCity ? 0 : null,
    categoryRequirements: jsonObject(category.requirements),
  }
}
""",
"""function quantityContext(profile: RequirementProfileRow, category: CategoryRequirementRow): PriceQuantityContext {
  return {
    guestCount: profile.guestCount,
    adultCount: profile.adultCount,
    childCount: profile.childCount,
    // Exact route distance is provider-specific. Until Wewed has geocoded routing
    // data, kilometre-based travel pricing must fail closed rather than assume zero.
    travelKm: null,
    categoryRequirements: jsonObject(category.requirements),
  }
}
""")
patch(market,
"quantityContext: quantityContext(profile, categoryRequirement, row),",
"quantityContext: quantityContext(profile, categoryRequirement),",
)

patch(market,
"""          packageName: pkg?.name ?? null,
          packagePriceCents: pkg?.priceCents ?? null,
""",
"""          packageName: pkg?.name ?? null,
          packagePriceCents: pkg?.priceCents ?? null,
          packagePricingUnit: pkg?.pricingUnit ?? null,
""")

old_input = '<input value={item.pricingUnit} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, pricingUnit: event.target.value } : entry))} placeholder="Pricing unit — package, guest, hour…" className={inputClass} />'
new_input = '<label className="block text-xs font-semibold text-espresso/70">Package base-price unit<input value={item.pricingUnit} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, pricingUnit: event.target.value } : entry))} placeholder="per package" className={`mt-1.5 ${inputClass}`} /><span className="mt-1 block font-normal text-espresso/45">For automatic Wedding Architect pricing use a fixed/package total such as “per package”. Put per-guest, per-hour or per-item charges in structured price components.</span></label>'
patch(manager, old_input, new_input)

print('Phase C package exactness alignment applied.')
