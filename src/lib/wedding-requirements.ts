import { PROVIDER_CATEGORY_VALUES } from '@/lib/provider-catalog'
import {
  WEDDING_PLAN_STRATEGIES,
  WEDDING_REQUIREMENT_PRIORITIES,
  weddingRequirementFields,
  type WeddingPlanStrategy,
  type WeddingRequirementPriority,
} from '@/lib/wedding-requirement-catalog'

export const WEDDING_BUDGET_CURRENCIES = ['USD', 'ZAR', 'GBP', 'EUR', 'BWP', 'ZMW', 'MZN'] as const

export type NormalizedWeddingRequirementProfile = {
  totalBudgetCents: number | null
  currency: string
  contingencyBasisPoints: number | null
  budgetFlexibilityBasisPoints: number | null
  guestCount: number | null
  adultCount: number | null
  childCount: number | null
  dateFlexibilityDays: number | null
  country: string | null
  city: string | null
  locationRadiusKm: number | null
  ceremonyType: string | null
  receptionType: string | null
  strategy: WeddingPlanStrategy
  styleTags: string[]
  culturalRequirements: string[]
  paymentConstraints: {
    maxMonthlySpendCents: number | null
    maxSingleDepositCents: number | null
    paymentPlanPreferred: boolean
  }
  notes: string | null
  completionScore: number
  confirmBrief: boolean
}

export type NormalizedWeddingCategoryRequirement = {
  category: string
  priority: WeddingRequirementPriority
  requirements: Record<string, unknown>
  notes: string | null
}

export type NormalizedWeddingRequirements = {
  profile: NormalizedWeddingRequirementProfile
  categories: NormalizedWeddingCategoryRequirement[]
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized ? normalized.slice(0, max) : null
}

function stringList(value: unknown, maxItems = 30, maxLength = 120): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => text(entry, maxLength))
    .filter((entry): entry is string => Boolean(entry)))]
    .slice(0, maxItems)
}

function integer(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`)
  }
  return numeric
}

function decimal(value: unknown, label: string, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null
  const numeric = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`)
  }
  return numeric
}

function moneyCents(value: unknown, label: string): number | null {
  const amount = decimal(value, label, 0, 100_000_000)
  return amount === null ? null : Math.round(amount * 100)
}

function basisPoints(value: unknown, label: string): number | null {
  const percentage = decimal(value, label, 0, 100)
  return percentage === null ? null : Math.round(percentage * 100)
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function normalizeFieldValue(
  category: string,
  key: string,
  value: unknown,
): unknown {
  const definition = weddingRequirementFields(category).find((entry) => entry.key === key)
  if (!definition) return undefined

  if (definition.type === 'boolean') {
    return typeof value === 'boolean' ? value : undefined
  }
  if (definition.type === 'number') {
    return integer(
      value,
      definition.label,
      definition.min ?? 0,
      definition.max ?? 1_000_000,
    )
  }
  if (definition.type === 'select') {
    const selected = text(value, 160)
    return selected && (!definition.options || definition.options.includes(selected))
      ? selected
      : undefined
  }
  if (definition.type === 'multiselect') {
    const selected = stringList(value, 30, 160)
    return definition.options
      ? selected.filter((entry) => definition.options!.includes(entry))
      : selected
  }
  return text(value, 1000)
}

export function calculateWeddingRequirementCompletion(input: {
  totalBudgetCents: number | null
  guestCount: number | null
  country: string | null
  city: string | null
  strategy: WeddingPlanStrategy
  categories: NormalizedWeddingCategoryRequirement[]
}): number {
  const activeCategories = input.categories.filter((entry) => entry.priority !== 'not_required')
  const checks = [
    input.totalBudgetCents !== null && input.totalBudgetCents > 0,
    input.guestCount !== null && input.guestCount > 0,
    Boolean(input.country),
    Boolean(input.city),
    WEDDING_PLAN_STRATEGIES.includes(input.strategy),
    activeCategories.length > 0,
    activeCategories.some((entry) => entry.priority === 'required' || entry.priority === 'strong_preference'),
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

export function normalizeWeddingRequirements(payload: unknown): NormalizedWeddingRequirements {
  const body = object(payload)
  const profileInput = object(body.profile)
  const currency = typeof profileInput.currency === 'string' && WEDDING_BUDGET_CURRENCIES.includes(profileInput.currency as typeof WEDDING_BUDGET_CURRENCIES[number])
    ? profileInput.currency
    : 'USD'
  const strategy = typeof profileInput.strategy === 'string' && WEDDING_PLAN_STRATEGIES.includes(profileInput.strategy as WeddingPlanStrategy)
    ? profileInput.strategy as WeddingPlanStrategy
    : 'balanced'

  const guestCount = integer(profileInput.guestCount, 'Guest count', 0, 100_000)
  const adultCount = integer(profileInput.adultCount, 'Adult count', 0, 100_000)
  const childCount = integer(profileInput.childCount, 'Child count', 0, 100_000)
  if (
    guestCount !== null &&
    adultCount !== null &&
    childCount !== null &&
    adultCount + childCount > guestCount
  ) {
    throw new Error('Adult and child counts cannot exceed the total guest count.')
  }

  const categoryRows = Array.isArray(body.categories) ? body.categories : []
  const seen = new Set<string>()
  const categories: NormalizedWeddingCategoryRequirement[] = []
  for (const rawEntry of categoryRows.slice(0, 100)) {
    const entry = object(rawEntry)
    const category = text(entry.category, 80)
    if (!category || !PROVIDER_CATEGORY_VALUES.has(category as never)) continue
    if (seen.has(category)) throw new Error(`Category ${category} was supplied more than once.`)
    seen.add(category)
    const priority = typeof entry.priority === 'string' && WEDDING_REQUIREMENT_PRIORITIES.includes(entry.priority as WeddingRequirementPriority)
      ? entry.priority as WeddingRequirementPriority
      : 'preferred'
    const rawRequirements = object(entry.requirements)
    const requirements: Record<string, unknown> = {}
    for (const definition of weddingRequirementFields(category)) {
      const normalized = normalizeFieldValue(category, definition.key, rawRequirements[definition.key])
      if (normalized !== undefined && normalized !== null && !(Array.isArray(normalized) && normalized.length === 0)) {
        requirements[definition.key] = normalized
      }
    }
    categories.push({
      category,
      priority,
      requirements,
      notes: text(entry.notes, 1500),
    })
  }

  const totalBudgetCents = moneyCents(profileInput.totalBudget, 'Wedding budget')
  const country = text(profileInput.country, 120)
  const city = text(profileInput.city, 160)
  const completionScore = calculateWeddingRequirementCompletion({
    totalBudgetCents,
    guestCount,
    country,
    city,
    strategy,
    categories,
  })

  return {
    profile: {
      totalBudgetCents,
      currency,
      contingencyBasisPoints: basisPoints(profileInput.contingencyPercent, 'Contingency'),
      budgetFlexibilityBasisPoints: basisPoints(profileInput.budgetFlexibilityPercent, 'Budget flexibility'),
      guestCount,
      adultCount,
      childCount,
      dateFlexibilityDays: integer(profileInput.dateFlexibilityDays, 'Date flexibility', 0, 3650),
      country,
      city,
      locationRadiusKm: integer(profileInput.locationRadiusKm, 'Location radius', 0, 50_000),
      ceremonyType: text(profileInput.ceremonyType, 160),
      receptionType: text(profileInput.receptionType, 160),
      strategy,
      styleTags: stringList(profileInput.styleTags, 30, 120),
      culturalRequirements: stringList(profileInput.culturalRequirements, 30, 240),
      paymentConstraints: {
        maxMonthlySpendCents: moneyCents(object(profileInput.paymentConstraints).maxMonthlySpend, 'Maximum monthly spend'),
        maxSingleDepositCents: moneyCents(object(profileInput.paymentConstraints).maxSingleDeposit, 'Maximum single deposit'),
        paymentPlanPreferred: object(profileInput.paymentConstraints).paymentPlanPreferred === true,
      },
      notes: text(profileInput.notes, 3000),
      completionScore,
      confirmBrief: profileInput.confirmBrief === true,
    },
    categories,
  }
}
