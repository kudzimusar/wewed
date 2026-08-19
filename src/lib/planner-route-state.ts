export type PlannerModuleSlug =
  | 'overview'
  | 'tasks'
  | 'budget'
  | 'vendors'
  | 'guests'
  | 'timeline'
  | 'seating'
  | 'contributions'

export type PlannerToolSlug = 'import' | 'imports'

const MODULES = new Set<PlannerModuleSlug>([
  'overview',
  'tasks',
  'budget',
  'vendors',
  'guests',
  'timeline',
  'seating',
  'contributions',
])

const TOOLS = new Set<PlannerToolSlug>(['import', 'imports'])

export function plannerLegacyModuleSlug(
  moduleKey: string | null | undefined,
): PlannerModuleSlug | null {
  if (!moduleKey) return null
  if (moduleKey === 'checklist') return 'tasks'
  return MODULES.has(moduleKey as PlannerModuleSlug) ? (moduleKey as PlannerModuleSlug) : null
}

export function plannerModuleFromPath(
  pathname: string,
  legacyModule?: string | null,
): PlannerModuleSlug {
  const segment = pathname.split('/').filter(Boolean)[1]
  if (segment && MODULES.has(segment as PlannerModuleSlug)) {
    return segment as PlannerModuleSlug
  }
  const legacySlug = plannerLegacyModuleSlug(legacyModule)
  if (legacySlug) return legacySlug
  return 'overview'
}

export function plannerToolFromPath(
  pathname: string,
  module: PlannerModuleSlug,
): PlannerToolSlug | null {
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] !== 'planner' || segments[1] !== module) return null
  const tool = segments[2]
  return tool && TOOLS.has(tool as PlannerToolSlug) ? (tool as PlannerToolSlug) : null
}

export function plannerModulePath(
  module: PlannerModuleSlug,
  tool?: PlannerToolSlug | null,
): string {
  return `/planner/${module}${tool ? `/${tool}` : ''}`
}

export function plannerWorksheetModuleSlug(moduleKey: string): PlannerModuleSlug {
  return plannerLegacyModuleSlug(moduleKey) ?? 'overview'
}
