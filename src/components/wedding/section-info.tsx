'use client'

import { useState } from 'react'
import { Info, X } from 'lucide-react'

/**
 * SectionInfo — small info icon that shows a tooltip on hover/click.
 * Add to any section heading to give first-time users context.
 *
 * Usage:
 * <SectionInfo text="Click any song's heart icon to vote for it. The DJ will see the live ranking on the wedding day." />
 */
export function SectionInfo({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <span className={`relative inline-flex ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label="More information"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold/70 transition-colors hover:bg-gold/20 hover:text-gold"
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <span
          className="absolute top-full left-1/2 z-50 mt-2 w-64 -translate-x-1/2 rounded-lg border border-gold/30 bg-espresso/95 p-3 text-left font-sans text-xs leading-relaxed text-champagne/90 shadow-xl backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close info"
            className="absolute right-2 top-2 text-champagne/40 hover:text-champagne"
          >
            <X className="h-3 w-3" />
          </button>
          {text}
        </span>
      )}
    </span>
  )
}
