from pathlib import Path


def replace_exact(path: str, old: str, new: str, count: int = 1):
    file = Path(path)
    text = file.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f'{path}: expected {count} exact matches, found {actual}')
    file.write_text(text.replace(old, new, count))

route = 'src/app/api/providers/profile/route.ts'
manager = 'src/components/providers/provider-profile-manager.tsx'

replace_exact(route,
"""import {
  defaultPriceBinding,
  priceComponentsUseCanonicalAutomaticBindings,
  providerPriceBindingOptions,
} from '@/lib/provider-price-bindings'
""",
"""import {
  defaultPriceBinding,
  providerPriceBindingOptions,
} from '@/lib/provider-price-bindings'
import {
  isApprovedAutomaticPriceBinding,
  priceComponentsUseApprovedAutomaticBindings,
} from '@/lib/wedding-architect-binding-policy'
""")

replace_exact(route,
"""        const automaticQuantityBindingsApproved =
          priceComponentsUseCanonicalAutomaticBindings(allPriceComponents)
""",
"""        const packageQuantityBindingsApproved = packages.every((packageInput) => {
          if (packageInput.additionalUnitPrice === null || packageInput.additionalUnitPrice === undefined || packageInput.additionalUnitPrice === '') return true
          const quantityType = text(packageInput.quantityType, 80)
          const quantityKey = text(packageInput.quantityKey, 160)
          const multiplierKey = text(packageInput.multiplierKey, 160)
          if (!quantityType || !quantityKey || !PRICE_COMPONENT_TYPE_SET.has(quantityType)) return false
          return isApprovedAutomaticPriceBinding({
            category,
            type: quantityType as Parameters<typeof isApprovedAutomaticPriceBinding>[0]['type'],
            quantityKey,
            multiplierKey,
          })
        })
        const automaticQuantityBindingsApproved =
          priceComponentsUseApprovedAutomaticBindings(category, allPriceComponents) && packageQuantityBindingsApproved
""", count=1)

replace_exact(route,
"""          const packageCommercialTerms = normalizeCommercialTerms(packageInput.commercialTerms)
          const packagePriceComponents = normalizePriceComponents(packageInput.priceComponents, String(offering.category))
          const packagePriceValidFrom = dateValue(packageInput.priceValidFrom, 'Package price valid from')
""",
"""          const packageCommercialTerms = normalizeCommercialTerms(packageInput.commercialTerms)
          const packageCategory = String(offering.category)
          const packagePriceComponents = normalizePriceComponents(packageInput.priceComponents, packageCategory)
          const packageQuantityType = text(packageInput.quantityType, 80)
          const packageQuantityKey = text(packageInput.quantityKey, 160)
          const packageMultiplierKey = text(packageInput.multiplierKey, 160)
          const packageAdditionalUnitPriceCents = moneyCents(packageInput.additionalUnitPrice, 'Package additional unit price')
          const allowedPackageBindings = new Set(providerPriceBindingOptions(packageCategory).map((option) => option.key))
          if (packageQuantityKey && !allowedPackageBindings.has(packageQuantityKey)) throw new Error('Package quantity source is invalid for this category.')
          if (packageMultiplierKey && !allowedPackageBindings.has(packageMultiplierKey)) throw new Error('Package quantity multiplier is invalid for this category.')
          if (packageAdditionalUnitPriceCents && (!packageQuantityType || !packageQuantityKey || !PRICE_COMPONENT_TYPE_SET.has(packageQuantityType))) {
            throw new Error('Package additional-unit pricing requires an explicit quantity type and wedding quantity source.')
          }
          if (packageAdditionalUnitPriceCents && !isApprovedAutomaticPriceBinding({
            category: packageCategory,
            type: packageQuantityType as Parameters<typeof isApprovedAutomaticPriceBinding>[0]['type'],
            quantityKey: packageQuantityKey,
            multiplierKey: packageMultiplierKey,
          })) {
            throw new Error('Package quantity pricing is not approved for automatic Wedding Architect calculation.')
          }
          const packagePriceValidFrom = dateValue(packageInput.priceValidFrom, 'Package price valid from')
""")

replace_exact(route,
"""            `INSERT INTO wewed_admin.\"ProviderPackage\" (id,\"offeringId\",name,description,\"priceCents\",currency,\"pricingUnit\",inclusions,\"sortOrder\",\"isActive\",\"minimumQuantity\",\"maximumQuantity\",\"includedQuantity\",\"additionalUnitPriceCents\",exclusions,\"requiredAddOns\",\"optionalAddOns\",\"commercialTerms\",\"priceComponents\",\"priceValidFrom\",\"priceValidUntil\",\"completionScore\") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,true,$10,$11,$12,$13,$14::jsonb,$15::jsonb,$16::jsonb,$17::jsonb,$18::jsonb,$19,$20,$21)`,
""",
"""            `INSERT INTO wewed_admin.\"ProviderPackage\" (id,\"offeringId\",name,description,\"priceCents\",currency,\"pricingUnit\",inclusions,\"sortOrder\",\"isActive\",\"minimumQuantity\",\"maximumQuantity\",\"includedQuantity\",\"additionalUnitPriceCents\",\"quantityType\",\"quantityKey\",\"multiplierKey\",exclusions,\"requiredAddOns\",\"optionalAddOns\",\"commercialTerms\",\"priceComponents\",\"priceValidFrom\",\"priceValidUntil\",\"completionScore\") VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,true,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19::jsonb,$20::jsonb,$21::jsonb,$22,$23,$24)`,
""")

replace_exact(route,
"""            nullableInteger(packageInput.includedQuantity, 'Package included quantity', 0, 1000000), moneyCents(packageInput.additionalUnitPrice, 'Package additional unit price'),
            JSON.stringify(stringList(packageInput.exclusions, 50)), JSON.stringify(stringList(packageInput.requiredAddOns, 50)), JSON.stringify(stringList(packageInput.optionalAddOns, 50)),
            JSON.stringify(packageCommercialTerms), JSON.stringify(packagePriceComponents), packagePriceValidFrom, packagePriceValidUntil, packageCompletion,
""",
"""            nullableInteger(packageInput.includedQuantity, 'Package included quantity', 0, 1000000), packageAdditionalUnitPriceCents,
            packageQuantityType || null, packageQuantityKey || null, packageMultiplierKey || null,
            JSON.stringify(stringList(packageInput.exclusions, 50)), JSON.stringify(stringList(packageInput.requiredAddOns, 50)), JSON.stringify(stringList(packageInput.optionalAddOns, 50)),
            JSON.stringify(packageCommercialTerms), JSON.stringify(packagePriceComponents), packagePriceValidFrom, packagePriceValidUntil, packageCompletion,
""")

replace_exact(manager,
"""  includedQuantity: string
  additionalUnitPrice: string
  exclusions: string[]
""",
"""  includedQuantity: string
  additionalUnitPrice: string
  quantityType: string
  quantityKey: string
  multiplierKey: string
  exclusions: string[]
""")

replace_exact(manager,
"""        includedQuantity: stringValue(entry.includedQuantity),
        additionalUnitPrice: priceValue(entry.additionalUnitPriceCents),
        exclusions: list(entry.exclusions),
""",
"""        includedQuantity: stringValue(entry.includedQuantity),
        additionalUnitPrice: priceValue(entry.additionalUnitPriceCents),
        quantityType: stringValue(entry.quantityType),
        quantityKey: stringValue(entry.quantityKey),
        multiplierKey: stringValue(entry.multiplierKey),
        exclusions: list(entry.exclusions),
""")

replace_exact(manager,
"""  const emptyPackage = (): PackageDraft => ({ name: '', description: '', price: '', currency, pricingUnit: '', inclusions: [], minimumQuantity: '', maximumQuantity: '', includedQuantity: '', additionalUnitPrice: '', exclusions: [], requiredAddOns: [], optionalAddOns: [], commercialTerms: { ...offeringCommercialTerms }, priceComponents: [], priceValidFrom: '', priceValidUntil: '', completionScore: 0 })
""",
"""  const bindingOptions = providerPriceBindingOptions(category)
  const variablePriceTypes = PRICE_COMPONENT_TYPES.filter((option) => priceComponentNeedsQuantity(option as PriceComponentType))
  const emptyPackage = (): PackageDraft => ({ name: '', description: '', price: '', currency, pricingUnit: '', inclusions: [], minimumQuantity: '', maximumQuantity: '', includedQuantity: '', additionalUnitPrice: '', quantityType: '', quantityKey: '', multiplierKey: '', exclusions: [], requiredAddOns: [], optionalAddOns: [], commercialTerms: { ...offeringCommercialTerms }, priceComponents: [], priceValidFrom: '', priceValidUntil: '', completionScore: 0 })
""")

old_ui = """<input type=\"number\" min=\"0\" step=\"0.01\" value={item.additionalUnitPrice} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, additionalUnitPrice: event.target.value } : entry))} placeholder=\"Additional unit price\" className={inputClass} />"""
new_ui = """<input type=\"number\" min=\"0\" step=\"0.01\" value={item.additionalUnitPrice} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, additionalUnitPrice: event.target.value } : entry))} placeholder=\"Additional unit price\" className={inputClass} /><label className=\"block text-xs font-semibold text-espresso/70\">Additional-price quantity type<select value={item.quantityType} onChange={(event) => { const nextType = event.target.value; onChange(value.map((entry, position) => position === index ? { ...entry, quantityType: nextType, quantityKey: nextType ? (defaultPriceBinding(nextType as PriceComponentType) ?? '') : '', multiplierKey: '' } : entry)) }} className={`mt-1.5 ${selectClass}`}><option value=\"\">No variable overage pricing</option>{variablePriceTypes.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>{item.quantityType && <><label className=\"block text-xs font-semibold text-espresso/70\">Wedding quantity for package overage<select value={item.quantityKey} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, quantityKey: event.target.value } : entry))} className={`mt-1.5 ${selectClass}`}><option value=\"\">Select quantity…</option>{bindingOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label className=\"block text-xs font-semibold text-espresso/70\">Optional quantity multiplier<select value={item.multiplierKey} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, multiplierKey: event.target.value } : entry))} className={`mt-1.5 ${selectClass}`}><option value=\"\">None</option>{bindingOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select><span className=\"mt-1 block font-normal text-espresso/45\">Used only for approved compound pricing such as rooms × nights.</span></label></>}"""
replace_exact(manager, old_ui, new_ui)

print('Phase C provider form/API parity patch applied successfully.')
