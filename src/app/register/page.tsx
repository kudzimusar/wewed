import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { PublicRegistrationForm } from '@/components/public/public-registration-form'
import { WewedBrand } from '@/components/brand/wewed-brand'

export const metadata: Metadata = {
  title: 'Register with Wewed',
  description: 'Apply for a Wewed couple, planner, venue, vendor or business account.',
  robots: { index: true, follow: true },
}

export default function RegisterPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-espresso px-5 py-10 text-champagne sm:py-14">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(191,155,95,0.14),transparent_28%),radial-gradient(circle_at_85%_30%,rgba(107,45,58,0.13),transparent_32%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gold/15 pb-5">
          <Link href="/" className="rounded-full pr-3 transition hover:bg-white/[0.035]" aria-label="Wewed home">
            <WewedBrand tone="dark" size="compact" descriptor="Create your account" />
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-gold/20 px-4 py-2 text-xs font-semibold text-champagne/65 transition hover:border-gold/45 hover:text-gold"><ArrowLeft className="size-3.5" />Back to Wewed</Link>
        </div>

        <div className="mb-8 mt-10 text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-gold"><Sparkles className="size-3.5" />Two-way onboarding</p>
          <h1 className="mt-4 font-serif text-5xl font-medium sm:text-6xl">Join Wewed</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-champagne/60">
            Apply from the public website. Wewed reviews your request, then completes the internal setup required for your account and workspace.
          </p>
          <div className="wewed-brand-hairline mx-auto mt-7 w-44" />
        </div>

        <div className="wewed-premium-panel overflow-hidden rounded-[2rem] border-gold/20 bg-[#211914]/90 p-1 shadow-2xl backdrop-blur">
          <Suspense fallback={<div className="rounded-[1.75rem] border border-gold/15 p-10 text-center text-sm text-champagne/50">Loading registration…</div>}>
            <PublicRegistrationForm />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
