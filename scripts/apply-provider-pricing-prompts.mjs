import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/components/providers/provider-profile-manager.tsx'
let source = readFileSync(path, 'utf8')

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`)
  source = source.replace(before, after)
}

replaceOnce(
  "} from '@/lib/provider-commercial'\n",
  "} from '@/lib/provider-commercial'\nimport { providerPricingPrompts } from '@/lib/provider-pricing-catalog'\n",
  'pricing catalogue import',
)

replaceOnce(
  `}) {\n  return (\n    <div className="mt-6 rounded-2xl border border-gold/20 bg-champagne/45 p-5">`,
  `}) {\n  const recommendedPricing = providerPricingPrompts(offering.category)\n  const missingRecommendedPricing = recommendedPricing.filter((recommended) =>\n    !offering.priceComponents.some((component) =>\n      component.type === recommended.type &&\n      component.label.trim().toLowerCase() === recommended.label.toLowerCase(),\n    ),\n  )\n  const addRecommendedPricing = () => {\n    if (missingRecommendedPricing.length === 0) return\n    onUpdate(index, {\n      priceComponents: [\n        ...offering.priceComponents,\n        ...missingRecommendedPricing.map((recommended) => ({\n          id: \`recommended-${'${recommended.key}'}\`,\n          label: recommended.label,\n          type: recommended.type,\n          amount: '',\n          unit: recommended.unit ?? '',\n          condition: recommended.help,\n          minimumQuantity: '',\n          maximumQuantity: '',\n        })),\n      ],\n    })\n  }\n\n  return (\n    <div className="mt-6 rounded-2xl border border-gold/20 bg-champagne/45 p-5">`,
  'offering category pricing setup',
)

replaceOnce(
  `      <PriceComponentEditor value={offering.priceComponents} onChange={(priceComponents) => onUpdate(index, { priceComponents })} />`,
  `      <div className="mt-7 border-t border-gold/15 pt-6">\n        <div className="flex flex-wrap items-start justify-between gap-3">\n          <div><h4 className="font-serif text-2xl">Commercial pricing checklist</h4><p className="mt-1 max-w-2xl text-xs leading-5 text-espresso/50">Wewed uses category-specific pricing drivers so the Wedding Architect can calculate this service for each couple. Add the relevant components, then enter your real prices. No amount is invented by AI.</p></div>\n          <button type="button" onClick={addRecommendedPricing} disabled={missingRecommendedPricing.length === 0} className="rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold disabled:opacity-40">{missingRecommendedPricing.length === 0 ? 'Pricing structure added' : 'Add recommended pricing structure'}</button>\n        </div>\n        <div className="mt-4 grid gap-2 sm:grid-cols-2">\n          {recommendedPricing.map((recommended) => {\n            const added = !missingRecommendedPricing.includes(recommended)\n            return <div key={recommended.key} className={\`rounded-xl border p-3 text-xs ${'${added ? "border-sage/25 bg-sage/5" : "border-gold/15 bg-white"}'}\`}><div className="flex items-center justify-between gap-2"><strong>{recommended.label}</strong><span className="text-[10px] uppercase tracking-[0.12em] text-espresso/40">{recommended.priority}</span></div><p className="mt-1 leading-5 text-espresso/50">{recommended.help}</p>{recommended.unit && <p className="mt-1 text-[10px] text-gold-muted">Unit: {recommended.unit}</p>}</div>\n          })}\n        </div>\n      </div>\n      <PriceComponentEditor value={offering.priceComponents} onChange={(priceComponents) => onUpdate(index, { priceComponents })} />`,
  'commercial pricing checklist UI',
)

replaceOnce(
  `<PackageEditor value={offering.packages} currency={offering.currency} onChange={(packages) => onUpdate(index, { packages })} />`,
  `<PackageEditor value={offering.packages} currency={offering.currency} offeringCommercialTerms={offering.commercialTerms} onChange={(packages) => onUpdate(index, { packages })} />`,
  'package offering terms inheritance',
)

replaceOnce(
  `function PackageEditor({ value, currency, onChange }: { value: PackageDraft[]; currency: string; onChange: (value: PackageDraft[]) => void }) {\n  const emptyPackage = (): PackageDraft => ({ name: '', description: '', price: '', currency, pricingUnit: '', inclusions: [], minimumQuantity: '', maximumQuantity: '', includedQuantity: '', additionalUnitPrice: '', exclusions: [], requiredAddOns: [], optionalAddOns: [], commercialTerms: commercialTermsDraft({}), priceComponents: [], priceValidFrom: '', priceValidUntil: '', completionScore: 0 })`,
  `function PackageEditor({ value, currency, offeringCommercialTerms, onChange }: { value: PackageDraft[]; currency: string; offeringCommercialTerms: CommercialTermsDraft; onChange: (value: PackageDraft[]) => void }) {\n  const emptyPackage = (): PackageDraft => ({ name: '', description: '', price: '', currency, pricingUnit: '', inclusions: [], minimumQuantity: '', maximumQuantity: '', includedQuantity: '', additionalUnitPrice: '', exclusions: [], requiredAddOns: [], optionalAddOns: [], commercialTerms: { ...offeringCommercialTerms }, priceComponents: [], priceValidFrom: '', priceValidUntil: '', completionScore: 0 })`,
  'package commercial inheritance signature',
)

replaceOnce(
  `<input value={item.pricingUnit} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, pricingUnit: event.target.value } : entry))} placeholder="Pricing unit — package, guest, hour…" className={inputClass} /><input type="date" value={item.priceValidUntil}`,
  `<input value={item.pricingUnit} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, pricingUnit: event.target.value } : entry))} placeholder="Pricing unit — package, guest, hour…" className={inputClass} /><input type="date" value={item.priceValidFrom} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, priceValidFrom: event.target.value } : entry))} aria-label="Package price valid from" className={inputClass} /><input type="date" value={item.priceValidUntil}`,
  'package valid-from field',
)

replaceOnce(
  `<textarea value={item.exclusions.join('\\n')} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, exclusions: event.target.value.split('\\n').map((line) => line.trim()).filter(Boolean) } : entry))} placeholder="One exclusion per line" className={textareaClass} /><textarea value={item.optionalAddOns.join('\\n')}`,
  `<textarea value={item.exclusions.join('\\n')} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, exclusions: event.target.value.split('\\n').map((line) => line.trim()).filter(Boolean) } : entry))} placeholder="One exclusion per line" className={textareaClass} /><textarea value={item.requiredAddOns.join('\\n')} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, requiredAddOns: event.target.value.split('\\n').map((line) => line.trim()).filter(Boolean) } : entry))} placeholder="Required add-ons/dependencies, one per line" className={textareaClass} /><textarea value={item.optionalAddOns.join('\\n')}`,
  'package required add-ons field',
)

replaceOnce(
  `placeholder="Optional add-ons, one per line" className={textareaClass} /></div><PriceComponentEditor`,
  `placeholder="Optional add-ons, one per line" className={textareaClass} /></div><p className="mt-3 text-[11px] leading-5 text-espresso/45">New packages inherit the offering-level tax, deposit, travel and balance rules. Package price components and dependencies can then make the package more specific.</p><PriceComponentEditor`,
  'package commercial inheritance guidance',
)

writeFileSync(path, source)
console.log('Category-specific provider pricing prompts integrated.')
