from pathlib import Path

path = Path('src/lib/wedding-architect-marketplace.ts')
text = path.read_text()

def one(old: str, new: str):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one match, found {count}: {old[:100]}')
    text = text.replace(old, new, 1)

one(
"import { priceComponentsUseApprovedAutomaticBindings } from '@/lib/wedding-architect-binding-policy'",
"import { isApprovedAutomaticPriceBinding, priceComponentsUseApprovedAutomaticBindings } from '@/lib/wedding-architect-binding-policy'",
)
one(
"""  providerName: string
  providerSlug: string
  listingStatus: string
""",
"""  providerName: string
  providerSlug: string
  providerCountry: string | null
  providerCity: string | null
  listingStatus: string
""",
)
one(
"""    automaticQuantityBindingsApproved: priceComponentsUseApprovedAutomaticBindings(row.category, allComponents),
""",
"""    automaticQuantityBindingsApproved:
      priceComponentsUseApprovedAutomaticBindings(row.category, allComponents) &&
      packages.every((pkg) => {
        if (!pkg.additionalUnitPriceCents || pkg.additionalUnitPriceCents <= 0) return true
        if (!pkg.quantityType || !pkg.quantityKey) return false
        return isApprovedAutomaticPriceBinding({
          category: row.category,
          type: pkg.quantityType,
          quantityKey: pkg.quantityKey,
          multiplierKey: pkg.multiplierKey,
        })
      }),
""",
)
one(
"""       pp.id AS \"providerId\", pp.\"businessAccountId\", pp.\"displayName\" AS \"providerName\",
       pp.slug AS \"providerSlug\", pp.\"listingStatus\", pp.\"completionScore\" AS \"profileCompletionScore\",
""",
"""       pp.id AS \"providerId\", pp.\"businessAccountId\", pp.\"displayName\" AS \"providerName\",
       pp.slug AS \"providerSlug\", pp.country AS \"providerCountry\", pp.city AS \"providerCity\",
       pp.\"listingStatus\", pp.\"completionScore\" AS \"profileCompletionScore\",
""",
)
one(
"""function quantityContext(profile: RequirementProfileRow, category: CategoryRequirementRow): PriceQuantityContext {
  return {
    guestCount: profile.guestCount,
    adultCount: profile.adultCount,
    childCount: profile.childCount,
    travelKm: 0,
    categoryRequirements: jsonObject(category.requirements),
  }
}
""",
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
)
one(
"quantityContext: quantityContext(profile, categoryRequirement),",
"quantityContext: quantityContext(profile, categoryRequirement, row),",
)
path.write_text(text)
print('Wedding Architect travel/readiness hardening applied.')
