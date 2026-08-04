import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowRight, Heart, Sparkles } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'

export function PublicInfoPage({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  children: ReactNode
  action?: { label: string; href: string }
}) {
  return (
    <PublicPlatformShell>
      <section className="relative isolate overflow-hidden bg-espresso px-4 py-20 text-champagne sm:px-6 sm:py-24">
        <img src="/media/wewed-couple-hero.svg" alt="" className="absolute inset-0 size-full object-cover object-center opacity-35" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(26,20,16,0.99),rgba(26,20,16,0.86)_62%,rgba(26,20,16,0.62))]" />
        <div className="relative mx-auto grid max-w-6xl items-end gap-10 lg:grid-cols-[1fr_18rem]">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-gold"><Sparkles className="size-3.5" />{eyebrow}</p>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-tight sm:text-7xl">{title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-champagne/75">{description}</p>
            {action && <Link href={action.href} className="mt-8 inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-espresso shadow-xl">{action.label}<ArrowRight className="size-4" /></Link>}
          </div>
          <div className="hidden rounded-3xl border border-white/15 bg-black/25 p-6 backdrop-blur lg:block">
            <Heart className="size-6 fill-gold text-gold" />
            <p className="mt-4 font-serif text-2xl">Made for meaningful celebrations.</p>
            <p className="mt-3 text-xs leading-5 text-champagne/65">A premium wedding platform designed around privacy, professional trust and bringing people together.</p>
          </div>
        </div>
      </section>
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6"><div className="absolute left-4 top-0 h-px w-24 bg-gradient-to-r from-gold to-transparent" />{children}</section>
    </PublicPlatformShell>
  )
}
