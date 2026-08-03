'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ExternalLink, Loader2, LogOut, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function WeddingPlatformNav({ slug }: { slug: string }) {
  const [leaving, setLeaving] = useState(false)

  async function leaveWedding() {
    setLeaving(true)
    try {
      await fetch(`/api/weddings/${encodeURIComponent(slug)}/guest-session`, { method: 'DELETE' })
    } finally {
      window.location.href = '/'
    }
  }

  return (
    <nav className="sticky top-16 z-40 border-b border-gold/20 bg-champagne/95 px-4 py-2 text-espresso shadow-sm backdrop-blur sm:px-6" aria-label="Wewed platform links">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto text-xs">
          <Link href="/" className="shrink-0 rounded-full px-3 py-2 font-semibold text-gold-muted hover:bg-gold/10">Powered by Wewed</Link>
          <Link href="/planners" className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 hover:bg-gold/10"><Search className="size-3.5" />Find a planner</Link>
          <Link href="/guest-access-help" className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 hover:bg-gold/10"><ExternalLink className="size-3.5" />Guest help</Link>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void leaveWedding()} disabled={leaving} className="shrink-0 text-xs text-espresso/60 hover:text-espresso">
          {leaving ? <Loader2 className="size-3.5 animate-spin" /> : <LogOut className="size-3.5" />}
          <span className="hidden sm:inline">Leave wedding</span>
        </Button>
      </div>
    </nav>
  )
}
