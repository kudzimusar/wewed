export const SAFETY_REPORT_REASONS = [
  'HARASSMENT',
  'HATE',
  'SEXUAL',
  'VIOLENCE',
  'SPAM',
  'SCAM',
  'PRIVACY',
  'DANGEROUS',
  'INACCURATE_AI',
  'OTHER',
] as const

export const AI_REPORT_AREAS = [
  'WEDDING_AI',
  'NOTEBOOK_AI',
  'MARKETPLACE_AI',
  'PROVIDER_AI',
] as const

export type SafetyReportReason = (typeof SAFETY_REPORT_REASONS)[number]
export type AiReportArea = (typeof AI_REPORT_AREAS)[number]

export class SafetyInputError extends Error {}

export function normalizeSafetyReason(value: unknown): SafetyReportReason {
  if (typeof value !== 'string') throw new SafetyInputError('Choose a reason for this report.')
  const reason = value.trim().toUpperCase()
  if (!SAFETY_REPORT_REASONS.includes(reason as SafetyReportReason)) {
    throw new SafetyInputError('Choose a valid reason for this report.')
  }
  return reason as SafetyReportReason
}

export function normalizeAiReportArea(value: unknown): AiReportArea {
  if (typeof value !== 'string') throw new SafetyInputError('The AI product area is required.')
  const area = value.trim().toUpperCase()
  if (!AI_REPORT_AREAS.includes(area as AiReportArea)) {
    throw new SafetyInputError('This AI product area cannot be reported here.')
  }
  return area as AiReportArea
}

export function normalizeOptionalSafetyText(
  value: unknown,
  maximum: number,
  label: string,
): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new SafetyInputError(`${label} must be text.`)
  const text = value.trim()
  if (!text) return null
  if (text.length > maximum) {
    throw new SafetyInputError(`${label} must be ${maximum} characters or fewer.`)
  }
  return text
}

export function normalizeAiSnapshot(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new SafetyInputError('The AI response is required.')
  }
  const snapshot = value.trim()
  if (snapshot.length > 8000) {
    throw new SafetyInputError('The AI response must be 8000 characters or fewer.')
  }
  return snapshot
}
