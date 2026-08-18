export const HISTORICAL_ENGAGEMENT_ORIGIN = 'historical' as const
export const HISTORICAL_ENGAGEMENT_RECORD_MODE = 'record_only' as const

export const HISTORICAL_EXTERNAL_AGREEMENT_STATUSES = ['unknown', 'exists', 'none'] as const
export type HistoricalExternalAgreementStatus = (typeof HISTORICAL_EXTERNAL_AGREEMENT_STATUSES)[number]

export interface HistoricalEngagementPaymentInput {
  amount: string
  paidAt: string | null
  method: string | null
  reference: string | null
  notes: string | null
}

export interface HistoricalEngagementInput {
  vendorId: string
  serviceCategory: string
  serviceDescription: string | null
  agreedAmount: string | null
  currency: string
  serviceDate: string | null
  serviceLocation: string | null
  externalAgreementStatus: HistoricalExternalAgreementStatus
  externalAgreementReference: string | null
  historicalBasis: string | null
  budgetItemIds: string[]
  payments: HistoricalEngagementPaymentInput[]
  origin: typeof HISTORICAL_ENGAGEMENT_ORIGIN
  recordMode: typeof HISTORICAL_ENGAGEMENT_RECORD_MODE
}

export class HistoricalEngagementInputError extends Error {
  field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'HistoricalEngagementInputError'
    this.field = field
  }
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HistoricalEngagementInputError('Historical engagement payload must be an object.')
  }
  return value as Record<string, unknown>
}

function requiredText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HistoricalEngagementInputError(`${field} is required.`, field)
  }
  const normalized = value.trim()
  if (normalized.length > maxLength) {
    throw new HistoricalEngagementInputError(`${field} is too long.`, field)
  }
  return normalized
}

function optionalText(value: unknown, field: string, maxLength: number): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') {
    throw new HistoricalEngagementInputError(`${field} must be text.`, field)
  }
  const normalized = value.trim()
  if (!normalized) return null
  if (normalized.length > maxLength) {
    throw new HistoricalEngagementInputError(`${field} is too long.`, field)
  }
  return normalized
}

function currencyCode(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HistoricalEngagementInputError('currency is required.', 'currency')
  }
  const normalized = value.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new HistoricalEngagementInputError('currency must be a three-letter currency code.', 'currency')
  }
  return normalized
}

function money(value: unknown, field: string, options: { nullable?: boolean; positive?: boolean } = {}): string | null {
  if (value == null || value === '') {
    if (options.nullable) return null
    throw new HistoricalEngagementInputError(`${field} is required.`, field)
  }

  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : ''
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new HistoricalEngagementInputError(`${field} must be a non-negative amount with at most two decimals.`, field)
  }

  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed > 999999999999.99 || (options.positive && parsed <= 0)) {
    throw new HistoricalEngagementInputError(
      options.positive ? `${field} must be greater than zero.` : `${field} is outside the supported range.`,
      field,
    )
  }

  return parsed.toFixed(2)
}

function optionalDate(value: unknown, field: string): string | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string') {
    throw new HistoricalEngagementInputError(`${field} must be an ISO date or date-time string.`, field)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new HistoricalEngagementInputError(`${field} is invalid.`, field)
  }
  return parsed.toISOString()
}

function stringIds(value: unknown): string[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 50) {
    throw new HistoricalEngagementInputError('budgetItemIds must be an array with at most 50 entries.', 'budgetItemIds')
  }
  const ids = value.map((item) => requiredText(item, 'budgetItemIds', 191))
  return [...new Set(ids)]
}

function payments(value: unknown): HistoricalEngagementPaymentInput[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 100) {
    throw new HistoricalEngagementInputError('payments must be an array with at most 100 entries.', 'payments')
  }

  return value.map((item, index) => {
    const payment = objectBody(item)
    return {
      amount: money(payment.amount, `payments[${index}].amount`, { positive: true })!,
      paidAt: optionalDate(payment.paidAt, `payments[${index}].paidAt`),
      method: optionalText(payment.method, `payments[${index}].method`, 120),
      reference: optionalText(payment.reference, `payments[${index}].reference`, 240),
      notes: optionalText(payment.notes, `payments[${index}].notes`, 2000),
    }
  })
}

/**
 * Phase 0 is intentionally record-only. The client cannot choose a contract origin,
 * acceptance state, or effective date, which prevents an old payment from being
 * transformed into fabricated Wewed contract history.
 */
export function normalizeHistoricalEngagementInput(value: unknown): HistoricalEngagementInput {
  const body = objectBody(value)
  const forbiddenHistoricalFields = [
    'origin',
    'recordMode',
    'acceptedAt',
    'effectiveAt',
    'contractAcceptedAt',
    'contractEffectiveAt',
  ]
  const suppliedForbidden = forbiddenHistoricalFields.find((field) => body[field] != null)
  if (suppliedForbidden) {
    throw new HistoricalEngagementInputError(
      `Historical rescue cannot set ${suppliedForbidden}; Phase 0 records facts only and never fabricates contract acceptance.`,
      suppliedForbidden,
    )
  }

  const externalAgreementStatus =
    typeof body.externalAgreementStatus === 'string'
      ? body.externalAgreementStatus.trim().toLowerCase()
      : 'unknown'
  if (!HISTORICAL_EXTERNAL_AGREEMENT_STATUSES.includes(externalAgreementStatus as HistoricalExternalAgreementStatus)) {
    throw new HistoricalEngagementInputError(
      'externalAgreementStatus must be unknown, exists, or none.',
      'externalAgreementStatus',
    )
  }

  return {
    vendorId: requiredText(body.vendorId, 'vendorId', 191),
    serviceCategory: requiredText(body.serviceCategory, 'serviceCategory', 120),
    serviceDescription: optionalText(body.serviceDescription, 'serviceDescription', 4000),
    agreedAmount: money(body.agreedAmount, 'agreedAmount', { nullable: true }),
    currency: currencyCode(body.currency ?? 'USD'),
    serviceDate: optionalDate(body.serviceDate, 'serviceDate'),
    serviceLocation: optionalText(body.serviceLocation, 'serviceLocation', 500),
    externalAgreementStatus: externalAgreementStatus as HistoricalExternalAgreementStatus,
    externalAgreementReference: optionalText(body.externalAgreementReference, 'externalAgreementReference', 1000),
    historicalBasis: optionalText(body.historicalBasis, 'historicalBasis', 4000),
    budgetItemIds: stringIds(body.budgetItemIds),
    payments: payments(body.payments),
    origin: HISTORICAL_ENGAGEMENT_ORIGIN,
    recordMode: HISTORICAL_ENGAGEMENT_RECORD_MODE,
  }
}

export function sumHistoricalPayments(items: HistoricalEngagementPaymentInput[]): string {
  const cents = items.reduce((total, item) => total + Math.round(Number(item.amount) * 100), 0)
  return (cents / 100).toFixed(2)
}
