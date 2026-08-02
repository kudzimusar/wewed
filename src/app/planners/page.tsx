import type { Metadata } from 'next'
import { PlannerDirectory } from '@/components/marketplace/planner-directory'

export const metadata: Metadata = {
  title: 'Find a Wedding Planner | Wewed',
  description: 'Discover verified wedding planners by service, style, price band, location, and availability through the Wewed planner marketplace.',
}

export default function PlannersPage() {
  return <PlannerDirectory />
}
