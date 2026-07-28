'use client'

import { useState } from 'react'
import { ClipboardList, Lock } from 'lucide-react'
import { WeddingPlanner } from '@/components/wedding/wedding-planner'

/* ============================================================
   PlannerTrigger — navbar button that opens the Wedding Planner
   ------------------------------------------------------------
   A small, elegant button shown in the navbar. It always shows
   (with a discreet lock icon) — the couple can log in from the
   planner's login gate. Clicking opens the WeddingPlanner dialog
   as a full-screen overlay.

   The lead agent wires this into the navbar (or anywhere else).
   This component is self-contained: manages its own open state
   and body scroll lock (defensive — the planner also does this).
   ============================================================ */

export interface PlannerTriggerProps {
  /** Optional className to override sizing/styling. */
  className?: string
  /** Compact mode: icon-only on tight screens. Defaults to false. */
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

      {open && <WeddingPlanner onClose={() => setOpen(false)} />}
    </>
  )
}

export default PlannerTrigger
