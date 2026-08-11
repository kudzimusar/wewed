import { redirect } from 'next/navigation'
import { plannerLegacyModuleSlug } from '@/lib/planner-route-state'

type PlannerLandingProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PlannerPage({ searchParams }: PlannerLandingProps) {
  const params = await searchParams
  const legacyModule = Array.isArray(params.module) ? params.module[0] : params.module
  const canonicalModule = plannerLegacyModuleSlug(legacyModule)

  if (canonicalModule) {
    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (key === 'module' || value === undefined) continue
      for (const item of Array.isArray(value) ? value : [value]) next.append(key, item)
    }
    const query = next.toString()
    redirect(`/planner/${canonicalModule}${query ? `?${query}` : ''}`)
  }

  redirect('/planner/portfolio')
}
