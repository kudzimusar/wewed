export type PlannerFeature =
  | 'plannerCore'
  | 'guestImportExport'
  | 'googleSheetsSync'
  | 'guestContributions'
  | 'aiPlanner'
  | 'publicPublishing'
  | 'payments'

const truthy = new Set(['1', 'true', 'yes', 'on'])

function enabled(name: string, fallback = false): boolean {
  const value = process.env[name]
  return value == null ? fallback : truthy.has(value.toLowerCase())
}

/**
 * Phase 0 policy: only verified core planner controls are visible by default.
 * Unfinished or externally dependent controls require an explicit environment flag.
 */
export const plannerFeatures: Readonly<Record<PlannerFeature, boolean>> = {
  plannerCore: enabled('NEXT_PUBLIC_FEATURE_PLANNER_CORE', true),
  guestImportExport: enabled('NEXT_PUBLIC_FEATURE_GUEST_IMPORT_EXPORT', false),
  googleSheetsSync: enabled('NEXT_PUBLIC_FEATURE_GOOGLE_SHEETS_SYNC', false),
  guestContributions: enabled('NEXT_PUBLIC_FEATURE_GUEST_CONTRIBUTIONS', false),
  aiPlanner: enabled('NEXT_PUBLIC_FEATURE_AI_PLANNER', false),
  publicPublishing: enabled('NEXT_PUBLIC_FEATURE_PUBLIC_PUBLISHING', false),
  payments: enabled('NEXT_PUBLIC_FEATURE_PAYMENTS', false),
}

export function isPlannerFeatureEnabled(feature: PlannerFeature): boolean {
  return plannerFeatures[feature]
}
