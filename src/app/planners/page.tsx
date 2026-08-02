import type { Metadata } from 'next'
import { PlannerDirectory } from '@/components/marketplace/planner-directory'

const title = 'Find a Wedding Planner | Wewed'
const description = 'Discover verified wedding planners by service, style, price band, location, and availability through the Wewed planner marketplace.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['Wewed', 'wedding planner', 'planner marketplace'],
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary', title, description },
}

export default function PlannersPage() {
  return <PlannerDirectory />
}
