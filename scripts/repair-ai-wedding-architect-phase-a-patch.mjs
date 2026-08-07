import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/app/api/providers/profile/route.ts'
const source = readFileSync(path, 'utf8')
const start = source.indexOf('function decimalText(')
const end = source.indexOf('function normalizeFaq(', start)

if (start < 0 || end < 0 || end <= start) {
  throw new Error('Provider commercial helper repair markers were not found.')
}

const helperBlock = `function decimalText(value: unknown, label: string, maxWholeDigits = 9): string | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).trim()
  const pattern = new RegExp('^\\\\d{1,' + maxWholeDigits + '}(?:\\\\.\\\\d{1,2})?$')
  if (!pattern.test(normalized)) {
    throw new Error(\`${'${label}'} must be a non-negative amount with at most two decimal places.\`)
  }
  return normalized
}

function dateValue(value: unknown, label: string): Date | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = new Date(String(value))
  if (!Number.isFinite(parsed.getTime())) throw new Error(\`${'${label}'} is invalid.\`)
  return parsed
}

function normalizeCommercialTerms(value: unknown): Record<string, unknown> {
  const source = jsonObject(value)
  const taxIncluded = source.taxIncluded === true || source.taxIncluded === 'true'
    ? true
    : source.taxIncluded === false || source.taxIncluded === 'false'
      ? false
      : null
  const serviceChargeType = typeof source.serviceChargeType === 'string' && CHARGE_TYPES.has(source.serviceChargeType)
    ? source.serviceChargeType
    : 'none'
  const depositType = typeof source.depositType === 'string' && DEPOSIT_TYPES.has(source.depositType)
    ? source.depositType
    : 'none'
  const availabilityMode = typeof source.availabilityMode === 'string' && AVAILABILITY_MODES.has(source.availabilityMode)
    ? source.availabilityMode
    : 'request'
  return {
    minimumSpend: decimalText(source.minimumSpend, 'Minimum spend'),
    includedQuantity: nullableInteger(source.includedQuantity, 'Included quantity', 0, 1000000),
    incrementalUnitPrice: decimalText(source.incrementalUnitPrice, 'Incremental unit price'),
    minimumBillableQuantity: nullableInteger(source.minimumBillableQuantity, 'Minimum billable quantity', 0, 1000000),
    billingIncrement: nullableInteger(source.billingIncrement, 'Billing increment', 1, 1000000),
    setupFee: decimalText(source.setupFee, 'Setup fee'),
    deliveryFee: decimalText(source.deliveryFee, 'Delivery fee'),
    includedTravelKm: nullableInteger(source.includedTravelKm, 'Included travel', 0, 50000),
    travelFeePerKm: decimalText(source.travelFeePerKm, 'Travel fee per kilometre'),
    overtimeRate: decimalText(source.overtimeRate, 'Overtime rate'),
    overtimeUnit: text(source.overtimeUnit, 80),
    taxIncluded,
    taxPercentage: decimalText(source.taxPercentage, 'Tax percentage', 3),
    serviceChargeType,
    serviceChargeValue: decimalText(source.serviceChargeValue, 'Service charge value'),
    depositType,
    depositValue: decimalText(source.depositValue, 'Deposit value'),
    balanceDueRule: text(source.balanceDueRule, 500),
    availabilityMode,
  }
}

function normalizePriceComponents(value: unknown): Array<Record<string, unknown>> {
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
}

`

const next = source.slice(0, start) + helperBlock + source.slice(end)
writeFileSync(path, next)
console.log('Provider commercial API helper block repaired.')
