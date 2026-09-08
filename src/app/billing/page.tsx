import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { SecureAccountBilling } from '@/components/billing/secure-account-billing'
import { Button } from '@/components/ui/button'
import {
  GOOGLE_PLAY_DISTRIBUTION_COOKIE,
  isGooglePlayDistributionValue,
} from '@/lib/google-play-distribution'

export const metadata: Metadata = {
  title: 'Wewed Billing',
  description: 'Review your Wewed account access and billing settings.',
  robots: { index: false, follow: false },
}

export default async function BillingPage() {
  const cookieStore = await cookies()
  if (
    isGooglePlayDistributionValue(
      cookieStore.get(GOOGLE_PLAY_DISTRIBUTION_COOKIE)?.value,
    )
  ) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ivory px-4 text-espresso">
        <section className="w-full max-w-xl rounded-3xl border border-gold/25 bg-white p-8 text-center shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Google Play app</p>
          <h1 className="mt-4 font-serif text-4xl">Your Wewed access</h1>
          <p className="mt-4 text-sm leading-7 text-espresso/65">
            Existing account access works in this app. Purchases, plan changes and external billing are unavailable here during testing.
          </p>
          <Button asChild className="mt-6 bg-espresso text-champagne hover:bg-espresso/90">
            <Link href="/app">Return to Wewed</Link>
          </Button>
        </section>
      </main>
    )
  }

  return <SecureAccountBilling />
}
