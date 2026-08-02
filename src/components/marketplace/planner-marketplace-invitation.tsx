'use client'

import Link from 'next/link'
import { ArrowRight, HeartHandshake } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PlannerMarketplaceInvitation() {
  return <section className="border-y border-gold/20 bg-champagne px-4 py-8 sm:px-6"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-5 sm:flex-row sm:items-center"><div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/10"><HeartHandshake className="size-5 text-gold-muted" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-muted">Wewed planner marketplace</p><h2 className="wewed-heading mt-1 text-2xl text-espresso">Need professional planning support?</h2><p className="mt-1 max-w-2xl text-sm text-espresso/60">Discover published planners and connect them securely to your existing wedding account only after a two-step appointment and explicit authority grant.</p></div></div><Button asChild className="shrink-0 bg-espresso text-champagne hover:bg-espresso/90"><Link href="/planners">Find a planner <ArrowRight className="size-4" /></Link></Button></div></section>
}
