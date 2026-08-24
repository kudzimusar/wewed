import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarCheck2 } from 'lucide-react'
import { AutoBookPolicyPanel } from '@/components/booking/autobook-policy-panel'
import { PlannerMarketplaceCentre } from '@/components/marketplace/planner-marketplace-centre'

const title = 'Planner Marketplace Centre | Wewed'
const description = 'Manage your professional planner profile, enquiries, appointments, bookings, and delegated wedding access in Wewed.'

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
      <span>New to the marketplace? <a href="/planner/get-listed" className="font-semibold underline decoration-gold underline-offset-4">Start with the four essentials</a>. You can add packages, policies and portfolio depth later.</span>
      <Link href="/planner/bookings" className="ml-3 inline-flex items-center gap-1 rounded-full bg-espresso px-3 py-1.5 text-xs font-bold text-champagne no-underline"><CalendarCheck2 className="size-3.5" /> My bookings</Link>
    </div>
    <div className="bg-espresso px-4 pb-2 pt-1 text-champagne sm:px-6"><div className="mx-auto max-w-6xl"><AutoBookPolicyPanel /></div></div>
    <PlannerMarketplaceCentre />
  </>
}
