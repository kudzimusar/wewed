export const CONTRIBUTION_TYPES = [
  'CASH_TO_COUPLE',
  'DIRECT_VENDOR_PAYMENT',
  'GOODS_IN_KIND',
  'SERVICE_IN_KIND',
  'TIME_LABOUR',
  'DISCOUNT_SPONSORSHIP',
  'HONEYMOON_GIFT',
  'OTHER',
] as const

export const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  CASH_TO_COUPLE: 'Money given to us',
  DIRECT_VENDOR_PAYMENT: 'Paid a vendor directly',
  GOODS_IN_KIND: 'Goods or materials',
  SERVICE_IN_KIND: 'A service',
  TIME_LABOUR: 'Time or help',
  DISCOUNT_SPONSORSHIP: 'Discount or sponsorship',
  HONEYMOON_GIFT: 'Honeymoon or experience gift',
  OTHER: 'Other support',
}

export type ContributionType = (typeof CONTRIBUTION_TYPES)[number]

const CASH_RECEIPT_TYPES = new Set<ContributionType>(['CASH_TO_COUPLE', 'HONEYMOON_GIFT'])
const IN_KIND_TYPES = new Set<ContributionType>(['GOODS_IN_KIND', 'SERVICE_IN_KIND', 'TIME_LABOUR', 'DISCOUNT_SPONSORSHIP'])
const FULFILLED_STATES = new Set(['RECEIVED', 'DELIVERED', 'PAID_DIRECT', 'COMPLETED'])

export function normalizeCurrency(value: unknown, fallback = 'USD'): string {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim())
    ? value.trim().toUpperCase()
    : fallback
}

export function finiteNonNegative(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function isFulfilled(state: string): boolean {
  return FULFILLED_STATES.has(state)
}

export function contributionAvailableAmount(input: {
  type: string
  amount: number | null
  fulfillmentState: string
  allocatedAmount?: number
}): number {
  if (!CASH_RECEIPT_TYPES.has(input.type as ContributionType) || input.fulfillmentState !== 'RECEIVED') return 0
  return Math.max(0, (input.amount ?? 0) - (input.allocatedAmount ?? 0))
}

export interface ContributionSummaryRow {
  type: string
  amount: number | null
  currency: string
  estimatedValue: number | null
  estimatedValueCurrency: string | null
  commitmentState: string
  fulfillmentState: string
  allocatedAmount?: number
}

export interface CurrencyContributionSummary {
  currency: string
  cashReceived: number
  directVendorPaid: number
  inKindValue: number
  pledged: number
  availableCash: number
}

export function summarizeContributions(rows: ContributionSummaryRow[]): CurrencyContributionSummary[] {
  const totals = new Map<string, CurrencyContributionSummary>()
  const bucket = (currency: string) => {
    const key = normalizeCurrency(currency)
    const current = totals.get(key) ?? {
      currency: key,
      cashReceived: 0,
      directVendorPaid: 0,
      inKindValue: 0,
      pledged: 0,
      availableCash: 0,
    }
    totals.set(key, current)
    return current
  }

  for (const row of rows) {
    const amount = row.amount ?? 0
    if (row.commitmentState === 'PLEDGED' && !isFulfilled(row.fulfillmentState)) {
      bucket(row.currency).pledged += amount
    }
    if (row.fulfillmentState === 'RECEIVED' && CASH_RECEIPT_TYPES.has(row.type as ContributionType)) {
      const current = bucket(row.currency)
      current.cashReceived += amount
      current.availableCash += contributionAvailableAmount({
        type: row.type,
        amount: row.amount,
        fulfillmentState: row.fulfillmentState,
        allocatedAmount: row.allocatedAmount ?? 0,
      })
    }
    if (row.type === 'DIRECT_VENDOR_PAYMENT' && row.fulfillmentState === 'PAID_DIRECT') {
      bucket(row.currency).directVendorPaid += amount
    }
    if (IN_KIND_TYPES.has(row.type as ContributionType) && isFulfilled(row.fulfillmentState) && (row.estimatedValue ?? 0) > 0) {
      bucket(row.estimatedValueCurrency ?? row.currency).inKindValue += row.estimatedValue ?? 0
    }
  }

  return Array.from(totals.values()).sort((a, b) => a.currency.localeCompare(b.currency))
}

export function validateContributionInput(input: Record<string, unknown>): string | null {
  if (!CONTRIBUTION_TYPES.includes(input.type as ContributionType)) return 'Choose a valid contribution type.'
  if (typeof input.title !== 'string' || !input.title.trim()) return 'Describe what was contributed.'
  const amount = finiteNonNegative(input.amount)
  if (['CASH_TO_COUPLE', 'DIRECT_VENDOR_PAYMENT', 'HONEYMOON_GIFT'].includes(String(input.type)) && (amount === null || amount <= 0)) {
    return 'Enter the amount contributed.'
  }
  if (input.estimatedValue !== undefined && input.estimatedValue !== null && input.estimatedValue !== '' && finiteNonNegative(input.estimatedValue) === null) {
    return 'Estimated value must be zero or more.'
  }
  return null
}

export function contributionDatabaseUnavailable(error: unknown): boolean {
  const value = error as { code?: string; message?: string }
  return value?.code === 'P2010' && Boolean(value.message?.includes('42P01')) || Boolean(value?.message?.includes('wewed_contributions'))
}
