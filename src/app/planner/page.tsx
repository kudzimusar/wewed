import { redirect } from 'next/navigation'

// Preview-only rebuild trigger for PR #96 UAT. No runtime behavior change.
const LEGACY_MODULES = new Set([
  'overview',
  'tasks',
  'budget',
  'vendors',
  'guests',
  'timeline',
  'seating',
])

type PlannerLandingProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PlannerPage({ searchParams }: PlannerLandingProps) {
  const params = await searchParams
  const legacyModule = Array.isArray(params.module) ? params.module[0] : params.module

  if (legacyModule && LEGACY_MODULES.has(legacyModule)) {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (key === 'module' || value === undefined) continue
      for (const item of Array.isArray(value) ? value : [value]) next.append(key, item)
    }
    const query = next.toString()
    redirect(`/planner/${legacyModule}${query ? `?${query}` : ''}`)
  }

  redirect('/planner/portfolio')
}
