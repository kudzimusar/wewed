import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { WewedPricingCatalog } from '@/components/public/wewed-pricing-catalog'
import { Button } from '@/components/ui/button'
import {
  GOOGLE_PLAY_DISTRIBUTION_COOKIE,
  isGooglePlayDistributionValue,
} from '@/lib/google-play-distribution'

export const metadata: Metadata = {
  title: 'Wewed Pricing',
  description: 'Review Wewed wedding-site, Canon and platform pricing without entering a private wedding.',
}

export default async function PricingRoute() {
  const cookieStore = await cookies()
  if (
    isGooglePlayDistributionValue(
      cookieStore.get(GOOGLE_PLAY_DISTRIBUTION_COOKIE)?.value,
    )
  ) {
    return (
      <PublicPlatformShell>
        <section className="flex min-h-[70dvh] items-center justify-center bg-ivory px-4 py-16 text-center text-espresso">
          <div className="max-w-xl rounded-3xl border border-gold/25 bg-white p-8 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Google Play app</p>
            <h1 className="mt-4 font-serif text-4xl">Plan with your existing access</h1>
            <p className="mt-4 text-sm leading-7 text-espresso/65">Purchases, paid-plan registration and external billing links are unavailable in this app during testing.</p>
            <Button asChild className="mt-6 bg-espresso text-champagne hover:bg-espresso/90"><Link href="/app">Return to Wewed</Link></Button>
          </div>
        </section>
      </PublicPlatformShell>
    )
  }

  return (
    <PublicPlatformShell>
      <section className="bg-espresso px-4 py-16 text-center text-champagne sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Wewed pricing</p>
        <h1 className="mt-4 font-serif text-5xl">Choose how your wedding lives.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-champagne/65">Pricing is part of the public Wewed platform and never requires access to a couple’s private wedding site.</p>
      </section>
      <WewedPricingCatalog />
    </PublicPlatformShell>
  )
}
