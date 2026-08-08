import type { WeddingPlanStrategy, WeddingRequirementPriority } from '@/lib/wedding-requirement-catalog'
import type { WeddingPriceCalculation } from '@/lib/wedding-architect-pricing'

export type WeddingArchitectPricedCandidate = {
  candidateId: string
  providerId: string
  businessAccountId: string
  offeringId: string
  packageId?: string | null
  category: string
  providerName: string
  providerSlug: string
  offeringName: string
  packageName?: string | null
  fitScore: number
  pricing: WeddingPriceCalculation
  warnings: string[]
  why: string[]
}

export type WeddingArchitectCategoryPool = {
  category: string
  priority: WeddingRequirementPriority
  candidates: WeddingArchitectPricedCandidate[]
}

export type WeddingArchitectPlanSelection = WeddingArchitectPricedCandidate & {
  priority: WeddingRequirementPriority
  categoryUtility: number
}

export type WeddingArchitectOptimizedPlan = {
  budgetCents: number
  contingencyCents: number
  spendableBudgetCents: number
  selectedCostCents: number
  remainingCents: number
  coverageComplete: boolean
  selections: WeddingArchitectPlanSelection[]
  uncoveredRequiredCategories: string[]
  omittedOptionalCategories: string[]
  strategy: WeddingPlanStrategy
}

type BeamState = {
  costCents: number
  utility: number
  selections: WeddingArchitectPlanSelection[]
  uncoveredRequiredCategories: string[]
  omittedOptionalCategories: string[]
}

const PRIORITY_WEIGHT: Record<WeddingRequirementPriority, number> = {
  required: 1.5,
  strong_preference: 1.25,
  preferred: 1,
  flexible: 0.7,
  not_required: 0,
}

const OMIT_PENALTY: Record<WeddingRequirementPriority, number> = {
  required: 10000,
  strong_preference: 180,
  preferred: 90,
  flexible: 25,
  not_required: 0,
}

function assertMoney(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer.`)
  return value
}

function strategyWeights(strategy: WeddingPlanStrategy): { fit: number; value: number } {
  if (strategy === 'value') return { fit: 0.5, value: 0.5 }
  if (strategy === 'priority_led') return { fit: 0.85, value: 0.15 }
  return { fit: 0.7, value: 0.3 }
}

function categoryCandidateUtility(
  candidate: WeddingArchitectPricedCandidate,
  minCost: number,
  maxCost: number,
  priority: WeddingRequirementPriority,
  strategy: WeddingPlanStrategy,
): number {
  const fit = Math.max(0, Math.min(100, candidate.fitScore))
  const valueScore = maxCost === minCost
    ? 100
    : 100 - ((candidate.pricing.totalCostCents - minCost) / (maxCost - minCost)) * 100
  const weights = strategyWeights(strategy)
  return (fit * weights.fit + valueScore * weights.value) * PRIORITY_WEIGHT[priority]
}

function stateRank(a: BeamState, b: BeamState): number {
  if (a.uncoveredRequiredCategories.length !== b.uncoveredRequiredCategories.length) {
    return a.uncoveredRequiredCategories.length - b.uncoveredRequiredCategories.length
  }
  if (a.utility !== b.utility) return b.utility - a.utility
  return a.costCents - b.costCents
}

export function optimizeWeddingArchitectPlan(input: {
  totalBudgetCents: number
  contingencyBasisPoints?: number | null
  strategy: WeddingPlanStrategy
  pools: WeddingArchitectCategoryPool[]
  beamWidth?: number
}): WeddingArchitectOptimizedPlan {
  const budgetCents = assertMoney(input.totalBudgetCents, 'Wedding budget')
  const contingencyBasisPoints = input.contingencyBasisPoints ?? 0
  if (!Number.isSafeInteger(contingencyBasisPoints) || contingencyBasisPoints < 0 || contingencyBasisPoints > 10000) {
    throw new Error('Contingency basis points must be between 0 and 10000.')
  }
  const contingencyCents = Math.round((budgetCents * contingencyBasisPoints) / 10000)
  const spendableBudgetCents = budgetCents - contingencyCents
  const beamWidth = Math.max(10, Math.min(500, input.beamWidth ?? 160))

  let beam: BeamState[] = [{
    costCents: 0,
    utility: 0,
    selections: [],
    uncoveredRequiredCategories: [],
    omittedOptionalCategories: [],
  }]

  for (const pool of input.pools.filter((entry) => entry.priority !== 'not_required')) {
    const candidates = [...pool.candidates]
      .filter((candidate) => candidate.category === pool.category)
      .sort((a, b) => b.fitScore - a.fitScore || a.pricing.totalCostCents - b.pricing.totalCostCents)
      .slice(0, 12)
    const costs = candidates.map((candidate) => candidate.pricing.totalCostCents)
    const minCost = costs.length ? Math.min(...costs) : 0
    const maxCost = costs.length ? Math.max(...costs) : 0
    const next: BeamState[] = []

    for (const state of beam) {
      const omission: BeamState = {
        ...state,
        utility: state.utility - OMIT_PENALTY[pool.priority],
        uncoveredRequiredCategories: pool.priority === 'required'
          ? [...state.uncoveredRequiredCategories, pool.category]
          : state.uncoveredRequiredCategories,
        omittedOptionalCategories: pool.priority === 'required'
          ? state.omittedOptionalCategories
          : [...state.omittedOptionalCategories, pool.category],
      }
      next.push(omission)

      for (const candidate of candidates) {
        const newCost = state.costCents + candidate.pricing.totalCostCents
        if (newCost > spendableBudgetCents) continue
        const categoryUtility = categoryCandidateUtility(candidate, minCost, maxCost, pool.priority, input.strategy)
        next.push({
          costCents: newCost,
          utility: state.utility + categoryUtility,
          selections: [...state.selections, { ...candidate, priority: pool.priority, categoryUtility }],
          uncoveredRequiredCategories: state.uncoveredRequiredCategories,
          omittedOptionalCategories: state.omittedOptionalCategories,
        })
      }
    }

    beam = next.sort(stateRank).slice(0, beamWidth)
  }

  const best = beam.sort(stateRank)[0] ?? {
    costCents: 0,
    utility: 0,
    selections: [],
    uncoveredRequiredCategories: [],
    omittedOptionalCategories: [],
  }

  return {
    budgetCents,
    contingencyCents,
    spendableBudgetCents,
    selectedCostCents: best.costCents,
    remainingCents: spendableBudgetCents - best.costCents,
    coverageComplete: best.uncoveredRequiredCategories.length === 0,
    selections: best.selections,
    uncoveredRequiredCategories: best.uncoveredRequiredCategories,
    omittedOptionalCategories: best.omittedOptionalCategories,
    strategy: input.strategy,
  }
}
