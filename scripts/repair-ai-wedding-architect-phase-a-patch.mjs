import { readFileSync, writeFileSync } from 'node:fs'

function patch(path, needle, replacement, label) {
  const source = readFileSync(path, 'utf8')
  const count = source.split(needle).length - 1
  if (count !== 1) throw new Error(`${label}: expected one match in ${path}, found ${count}`)
  writeFileSync(path, source.replace(needle, replacement))
}

const api = 'src/app/api/providers/profile/route.ts'
patch(
  api,
  `function dateValue(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) throw new Error(\`${'${label}'} is invalid.\`)
  return parsed
}`,
  `function dateValue(value: unknown, label: string, endOfDay = false): Date | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).trim()
  const parsed = /^\\d{4}-\\d{2}-\\d{2}$/.test(normalized)
    ? new Date(\`${'${normalized}'}T${'${endOfDay ? "23:59:59.999" : "00:00:00.000"}'}Z\`)
    : new Date(normalized)
  if (!Number.isFinite(parsed.getTime())) throw new Error(\`${'${label}'} is invalid.\`)
  return parsed
}`,
  'date-only validity semantics',
)
patch(
  api,
  "        const priceValidUntil = dateValue(input.priceValidUntil, 'Price valid until')",
  "        const priceValidUntil = dateValue(input.priceValidUntil, 'Price valid until', true)",
  'offering valid-until end-of-day',
)
patch(
  api,
  "          const packagePriceValidUntil = dateValue(packageInput.priceValidUntil, 'Package price valid until')",
  "          const packagePriceValidUntil = dateValue(packageInput.priceValidUntil, 'Package price valid until', true)",
  'package valid-until end-of-day',
)
patch(
  api,
  "        const commercialConfirmed = input.confirmCommercialPricing === true || Boolean(input.ownerConfirmedCommercialAt)",
  "        const commercialConfirmed = input.confirmCommercialPricing === true",
  'explicit commercial confirmation',
)
patch(
  api,
  `"ownerConfirmedCommercialAt"=CASE WHEN $23 THEN CURRENT_TIMESTAMP ELSE wewed_admin."ProviderServiceOffering"."ownerConfirmedCommercialAt" END`,
  `"ownerConfirmedCommercialAt"=CASE WHEN $23 THEN CURRENT_TIMESTAMP ELSE NULL END`,
  'clear stale commercial confirmation',
)

const manager = 'src/components/providers/provider-profile-manager.tsx'
patch(
  manager,
  "    confirmCommercialPricing: false,\n    aiReadinessScore: Number(row.aiReadinessScore || 0),",
  "    confirmCommercialPricing: Boolean(row.ownerConfirmedCommercialAt),\n    aiReadinessScore: Number(row.aiReadinessScore || 0),",
  'restore confirmed state only for unchanged loaded data',
)
patch(
  manager,
  `const BOOKING_NOTICE = ['1–2 weeks', '1 month', '2–3 months', '4–6 months', '6–12 months', '12+ months', 'Depends on service'] as const
`,
  `const BOOKING_NOTICE = ['1–2 weeks', '1 month', '2–3 months', '4–6 months', '6–12 months', '12+ months', 'Depends on service'] as const
const AI_PLANNING_DATA_KEYS = new Set<keyof OfferingDraft>([
  'startingPrice', 'maximumPrice', 'currency', 'pricingModel', 'pricingVisibility',
  'commercialTerms', 'priceComponents', 'priceValidFrom', 'priceValidUntil',
  'minimumCapacity', 'maximumCapacity', 'bookingLeadTime', 'serviceAreas',
  'inclusions', 'details', 'packages',
])
`,
  'AI planning edit invalidation keys',
)
patch(
  manager,
  `  function updateOffering(index: number, patch: Partial<OfferingDraft>) {
    setOfferings((current) => current.map((entry, position) => position === index ? { ...entry, ...patch } : entry))
  }`,
  `  function updateOffering(index: number, patch: Partial<OfferingDraft>) {
    const planningDataChanged = Object.keys(patch).some((key) =>
      key !== 'confirmCommercialPricing' && AI_PLANNING_DATA_KEYS.has(key as keyof OfferingDraft),
    )
    setOfferings((current) => current.map((entry, position) => {
      if (position !== index) return entry
      const next = { ...entry, ...patch }
      return planningDataChanged ? { ...next, confirmCommercialPricing: false } : next
    }))
  }`,
  'invalidate confirmation after planning-data edit',
)

console.log('Provider AI-readiness confirmation and price-validity semantics hardened.')
