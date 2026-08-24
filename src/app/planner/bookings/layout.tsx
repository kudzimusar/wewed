import Link from 'next/link'
import type { ReactNode } from 'react'

export default function PlannerBookingsLayout({ children }: { children: ReactNode }) {
  return <>
    <div className="bg-espresso px-4 pt-4 text-champagne sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/20 bg-champagne/5 px-4 py-3 text-xs">
        <span className="text-champagne/60">Booking lifecycle controls use canonical contract, payment and amendment evidence.</span>
        <Link href="/planner/bookings/manage" className="inline-flex min-h-9 items-center rounded-full border border-gold/30 px-4 font-bold text-gold">Manage deposits & amendments</Link>
      </div>
    </div>
    {children}
  </>
}
