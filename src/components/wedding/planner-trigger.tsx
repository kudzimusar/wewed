'use client'

import { useState } from 'react'
import { ClipboardList, Lock } from 'lucide-react'
import { SecureWeddingPlanner } from '@/components/wedding/secure-wedding-planner'

export interface PlannerTriggerProps {
  className?: string
  compact?: boolean
}

export function PlannerTrigger({ className, compact = false }: PlannerTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the Wedding Planner"
        title="Plan the Wedding"
        className={`group inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/5 px-2.5 py-1.5 font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-gold transition-all hover:border-gold hover:bg-gold/15 hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-1 focus-visible:ring-offset-espresso ${
          className ?? ''
        }`}
      >
        <ClipboardList className="size-3.5 transition-transform group-hover:scale-110" />
        {!compact && <span className="hidden sm:inline">Plan</span>}
        <Lock className="size-2.5 text-gold/60" aria-hidden="true" />
      </button>

      {open && <SecureWeddingPlanner onClose={() => setOpen(false)} />}
    </>
  )
}

export default PlannerTrigger
