import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PublicRegistrationForm } from '@/components/public/public-registration-form'

export const metadata: Metadata = {
  title: 'Register with Wewed',
  description: 'Apply for a Wewed couple, planner, venue, vendor or business account.',
  robots: { index: true, follow: true },
}

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-espresso px-5 py-14 text-champagne">
      <div className="mx-auto max-w-4xl">
        <a href="/" className="text-sm text-gold hover:text-gold-light">← Back to Wewed</a>
        <div className="mb-8 mt-8 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-gold">Two-way onboarding</p>
          <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">Join Wewed</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-champagne/60">
            Apply from the public website. Wewed reviews your request, then completes the internal setup required for your account and workspace.
          </p>
        </div>
        <Suspense fallback={<div className="rounded-2xl border border-gold/20 p-8 text-center text-sm text-champagne/50">Loading registration…</div>}>
          <PublicRegistrationForm />
        </Suspense>
      </div>
    </main>
  )
}
