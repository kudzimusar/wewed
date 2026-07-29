'use client'

import Link from 'next/link'
import { ClipboardList, Lock } from 'lucide-react'

export interface PlannerTriggerProps {
  className?: string
  compact?: boolean
}

export function PlannerTrigger({ className, compact = false }: PlannerTriggerProps) {
  return (
    <Link
      href="/planner"
      aria-label="Open the Wewed Planner Workspace"
      title="Open Planner Workspace"
      className={`group inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/5 px-2.5 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-gold transition-all hover:border-gold hover:bg-gold/15 hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-1 focus-visible:ring-offset-espresso ${
        className ?? ''
      }`}
    >
      <ClipboardList className="size-3.5 transition-transform group-hover:scale-110" />
      {!compact && <span className="hidden sm:inline">Planner</span>}
      <Lock className="size-2.5 text-gold/60" aria-hidden="true" />
    </Link>
  )
}

export default PlannerTrigger
