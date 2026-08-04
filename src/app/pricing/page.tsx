import type { Metadata } from 'next'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { WewedPricingCatalog } from '@/components/public/wewed-pricing-catalog'

export const metadata: Metadata = {
  title: 'Wewed Pricing',
  description: 'Review Wewed wedding-site, Canon and platform pricing without entering a private wedding.',
}

export default function PricingRoute() {
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
