import type { Metadata } from 'next'
import { PlannerMarketplaceCentre } from '@/components/marketplace/planner-marketplace-centre'

const title = 'Planner Marketplace Centre | Wewed'
const description = 'Manage your professional planner profile, enquiries, appointments, and delegated wedding access in Wewed.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['Wewed', 'planner marketplace', 'planner business'],
  robots: { index: false, follow: false },
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary', title, description },
}

export default function PlannerMarketplacePage() {
  return <>
    <div className="border-b border-gold/15 bg-champagne px-4 py-3 text-center text-sm text-espresso">
      New to the marketplace? <a href="/planner/get-listed" className="font-semibold underline decoration-gold underline-offset-4">Start with the four essentials</a>. You can add packages, policies and portfolio depth later.
    </div>
    <PlannerMarketplaceCentre />
  </>
}
