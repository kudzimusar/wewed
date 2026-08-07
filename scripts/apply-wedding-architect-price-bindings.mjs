import { readFileSync, writeFileSync } from 'node:fs'

function patch(path, before, after, label) {
  const source = readFileSync(path, 'utf8')
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match in ${path}, found ${count}`)
  writeFileSync(path, source.replace(before, after))
}

const api = 'src/app/api/providers/profile/route.ts'
patch(
  api,
  "} from '@/lib/provider-commercial'\n",
  "} from '@/lib/provider-commercial'\nimport { defaultPriceBinding, providerPriceBindingOptions } from '@/lib/provider-price-bindings'\n",
  'provider price binding API import',
)
patch(
  api,
  `function normalizePriceComponents(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  return value.slice(0, 60).map((entry, index) => {
    const row = jsonObject(entry)
    const type = typeof row.type === 'string' && PRICE_COMPONENT_TYPE_SET.has(row.type) ? row.type : 'fixed'
    return {
      id: text(row.id, 160) || \`component-${'${index + 1}'}\`,
      label: text(row.label, 160) || \`Price component ${'${index + 1}'}\`,
      type,
      amount: decimalText(row.amount, 'Price component amount'),
      unit: text(row.unit, 80),
      condition: text(row.condition, 500),
      minimumQuantity: nullableInteger(row.minimumQuantity, 'Price component minimum quantity', 0, 1000000),
      maximumQuantity: nullableInteger(row.maximumQuantity, 'Price component maximum quantity', 0, 1000000),
    }
  }).filter((entry) => entry.amount !== null)
}`,
  `function normalizePriceComponents(value: unknown, category: string): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return []
  const allowedBindings = new Set(providerPriceBindingOptions(category).map((option) => option.key))
  return value.slice(0, 60).map((entry, index) => {
    const row = jsonObject(entry)
    const type = typeof row.type === 'string' && PRICE_COMPONENT_TYPE_SET.has(row.type) ? row.type : 'fixed'
    const defaultBinding = defaultPriceBinding(type as Parameters<typeof defaultPriceBinding>[0])
    const requestedQuantityKey = text(row.quantityKey, 160) || defaultBinding
    const requestedMultiplierKey = text(row.multiplierKey, 160)
    if (requestedQuantityKey && !allowedBindings.has(requestedQuantityKey)) {
      throw new Error(\`Price component ${'${index + 1}'} uses an invalid wedding quantity binding.\`)
    }
    if (requestedMultiplierKey && !allowedBindings.has(requestedMultiplierKey)) {
      throw new Error(\`Price component ${'${index + 1}'} uses an invalid wedding quantity multiplier.\`)
    }
    return {
      id: text(row.id, 160) || \`component-${'${index + 1}'}\`,
      label: text(row.label, 160) || \`Price component ${'${index + 1}'}\`,
      type,
      amount: decimalText(row.amount, 'Price component amount'),
      unit: text(row.unit, 80),
      condition: text(row.condition, 500),
      minimumQuantity: nullableInteger(row.minimumQuantity, 'Price component minimum quantity', 0, 1000000),
      maximumQuantity: nullableInteger(row.maximumQuantity, 'Price component maximum quantity', 0, 1000000),
      quantityKey: requestedQuantityKey ?? null,
      multiplierKey: requestedMultiplierKey ?? null,
    }
  }).filter((entry) => entry.amount !== null)
}`,
  'server price component binding normalisation',
)
patch(
  api,
  '        const priceComponents = normalizePriceComponents(input.priceComponents)\n',
  '        const priceComponents = normalizePriceComponents(input.priceComponents, category)\n',
  'offering price component category binding',
)
patch(
  api,
  '          const packagePriceComponents = normalizePriceComponents(packageInput.priceComponents)\n',
  '          const packagePriceComponents = normalizePriceComponents(packageInput.priceComponents, String(offering.category))\n',
  'package price component category binding',
)

const manager = 'src/components/providers/provider-profile-manager.tsx'
patch(
  manager,
  `  PRICING_VISIBILITY_OPTIONS,
} from '@/lib/provider-commercial'
import { providerPricingPrompts } from '@/lib/provider-pricing-catalog'
`,
  `  PRICING_VISIBILITY_OPTIONS,
  type PriceComponentType,
} from '@/lib/provider-commercial'
import {
  defaultPriceBinding,
  priceComponentNeedsQuantity,
  providerPriceBindingOptions,
} from '@/lib/provider-price-bindings'
import { providerPricingPrompts } from '@/lib/provider-pricing-catalog'
`,
  'provider price binding UI imports',
)
patch(
  manager,
  `  condition: string
  minimumQuantity: string
  maximumQuantity: string
}`,
  `  condition: string
  minimumQuantity: string
  maximumQuantity: string
  quantityKey: string
  multiplierKey: string
}`,
  'price component draft binding fields',
)
patch(
  manager,
  `      condition: stringValue(row.condition),
      minimumQuantity: stringValue(row.minimumQuantity),
      maximumQuantity: stringValue(row.maximumQuantity),
`,
  `      condition: stringValue(row.condition),
      minimumQuantity: stringValue(row.minimumQuantity),
      maximumQuantity: stringValue(row.maximumQuantity),
      quantityKey: stringValue(row.quantityKey),
      multiplierKey: stringValue(row.multiplierKey),
`,
  'load saved price bindings',
)
patch(
  manager,
  `          condition: recommended.help,
          minimumQuantity: '',
          maximumQuantity: '',
`,
  `          condition: recommended.help,
          minimumQuantity: '',
          maximumQuantity: '',
          quantityKey: defaultPriceBinding(recommended.type) ?? '',
          multiplierKey: '',
`,
  'recommended price component default binding',
)
patch(
  manager,
  `<PriceComponentEditor value={offering.priceComponents} onChange={(priceComponents) => onUpdate(index, { priceComponents })} />`,
  `<PriceComponentEditor category={offering.category} value={offering.priceComponents} onChange={(priceComponents) => onUpdate(index, { priceComponents })} />`,
  'offering price editor category prop',
)
patch(
  manager,
  `<PackageEditor value={offering.packages} currency={offering.currency} offeringCommercialTerms={offering.commercialTerms} onChange={(packages) => onUpdate(index, { packages })} />`,
  `<PackageEditor category={offering.category} value={offering.packages} currency={offering.currency} offeringCommercialTerms={offering.commercialTerms} onChange={(packages) => onUpdate(index, { packages })} />`,
  'package editor category prop',
)

const priceEditorStart = sourceMarker(manager, 'function PriceComponentEditor(')
const priceEditorEnd = sourceMarker(manager, '\nfunction PackageEditor(', priceEditorStart)
const currentManager = readFileSync(manager, 'utf8')
const oldPriceEditor = currentManager.slice(priceEditorStart, priceEditorEnd)
const newPriceEditor = `function PriceComponentEditor({ category, value, onChange }: { category: string; value: PriceComponentDraft[]; onChange: (value: PriceComponentDraft[]) => void }) {
  const bindingOptions = providerPriceBindingOptions(category)
  const updateType = (index: number, type: string) => {
    onChange(value.map((entry, position) => position === index ? {
      ...entry,
      type,
      quantityKey: defaultPriceBinding(type as PriceComponentType) ?? '',
      multiplierKey: '',
    } : entry))
  }
  return <div className="mt-7 border-t border-gold/15 pt-6"><div className="flex items-center justify-between gap-3"><div><h4 className="font-serif text-2xl">Structured price components</h4><p className="mt-1 text-xs text-espresso/50">Break down charges that Wewed must calculate instead of asking AI to guess them. Variable charges must be bound to the exact wedding quantity that drives the price.</p></div><button type="button" onClick={() => onChange([...value, { id: \`component-${'${Date.now()}'}\`, label: '', type: 'fixed', amount: '', unit: '', condition: '', minimumQuantity: '', maximumQuantity: '', quantityKey: '', multiplierKey: '' }])} className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-3 py-2 text-xs font-semibold"><Plus className="size-3.5" />Add component</button></div><div className="mt-4 space-y-3">{value.map((item, index) => {
    const needsQuantity = priceComponentNeedsQuantity(item.type as PriceComponentType)
    return <div key={item.id || index} className="grid gap-3 rounded-xl border border-gold/15 bg-white p-4 sm:grid-cols-2"><input value={item.label} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, label: event.target.value } : entry))} placeholder="Charge name — e.g. Adult guest" className={inputClass} /><select value={item.type} onChange={(event) => updateType(index, event.target.value)} className={selectClass}>{PRICE_COMPONENT_TYPES.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select><input type="number" min="0" step="0.01" value={item.amount} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, amount: event.target.value } : entry))} placeholder="Amount or percentage" className={inputClass} /><input value={item.unit} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, unit: event.target.value } : entry))} placeholder="Unit — guest, hour, item…" className={inputClass} />{needsQuantity && <><label className="block text-xs font-semibold text-espresso/70">Wedding quantity source<select value={item.quantityKey} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, quantityKey: event.target.value } : entry))} className={\`mt-1.5 ${'${selectClass}'}\`}><option value="">Select the quantity that drives this charge…</option>{bindingOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label><label className="block text-xs font-semibold text-espresso/70">Optional quantity multiplier<select value={item.multiplierKey} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, multiplierKey: event.target.value } : entry))} className={\`mt-1.5 ${'${selectClass}'}\`}><option value="">None</option>{bindingOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select><span className="mt-1 block font-normal text-espresso/45">Use for compound pricing such as rooms × nights or guards × hours.</span></label></>}<input type="number" min="0" value={item.minimumQuantity} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, minimumQuantity: event.target.value } : entry))} placeholder="Minimum quantity" className={inputClass} /><input type="number" min="0" value={item.maximumQuantity} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, maximumQuantity: event.target.value } : entry))} placeholder="Maximum quantity" className={inputClass} /><textarea value={item.condition} onChange={(event) => onChange(value.map((entry, position) => position === index ? { ...entry, condition: event.target.value } : entry))} placeholder="When does this component apply?" className={\`${'${textareaClass}'} min-h-20 sm:col-span-2\`} /><div className="sm:col-span-2 flex justify-end"><button type="button" onClick={() => onChange(value.filter((_, position) => position !== index))} className="inline-flex items-center gap-1 text-xs text-clay"><Trash2 className="size-3.5" />Remove component</button></div></div>
  })}</div></div>
}
`
writeFileSync(manager, readFileSync(manager, 'utf8').replace(oldPriceEditor, newPriceEditor))

let managerAfterEditor = readFileSync(manager, 'utf8')
const packageSignatureBefore = `function PackageEditor({ value, currency, offeringCommercialTerms, onChange }: { value: PackageDraft[]; currency: string; offeringCommercialTerms: CommercialTermsDraft; onChange: (value: PackageDraft[]) => void }) {`
const packageSignatureAfter = `function PackageEditor({ category, value, currency, offeringCommercialTerms, onChange }: { category: string; value: PackageDraft[]; currency: string; offeringCommercialTerms: CommercialTermsDraft; onChange: (value: PackageDraft[]) => void }) {`
if ((managerAfterEditor.split(packageSignatureBefore).length - 1) !== 1) throw new Error('package editor signature: expected one match')
managerAfterEditor = managerAfterEditor.replace(packageSignatureBefore, packageSignatureAfter)
const packageEmptyBefore = `priceComponents: [], priceValidFrom: '', priceValidUntil: '', completionScore: 0 })`
const packageEmptyAfter = `priceComponents: [], priceValidFrom: '', priceValidUntil: '', completionScore: 0 })`
const packagePriceEditorBefore = `<PriceComponentEditor value={item.priceComponents} onChange={(priceComponents) => onChange(value.map((entry, position) => position === index ? { ...entry, priceComponents } : entry))} />`
const packagePriceEditorAfter = `<PriceComponentEditor category={category} value={item.priceComponents} onChange={(priceComponents) => onChange(value.map((entry, position) => position === index ? { ...entry, priceComponents } : entry))} />`
if ((managerAfterEditor.split(packagePriceEditorBefore).length - 1) !== 1) throw new Error('package price editor: expected one match')
managerAfterEditor = managerAfterEditor.replace(packagePriceEditorBefore, packagePriceEditorAfter)
writeFileSync(manager, managerAfterEditor)

function sourceMarker(path, marker, from = 0) {
  const source = readFileSync(path, 'utf8')
  const index = source.indexOf(marker, from)
  if (index < 0) throw new Error(`${path}: marker not found: ${marker}`)
  return index
}

console.log('Provider variable-price quantities are now explicitly bound to the shared wedding requirement model.')
