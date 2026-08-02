'use client'

import { useState } from 'react'
import { ArrowRight, Check, Crown, Gift, Sparkles, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  WEWED_PLANS,
  annualMonthlyEquivalent,
  formatUsd,
  type WewedBillingInterval,
} from '@/lib/wewed-plans'

const icons = {
  free: Gift,
  starter: Crown,
  professional: Sparkles,
  enterprise: Building2,
} as const

export function WewedPricingCatalog() {
  const [interval, setInterval] = useState<WewedBillingInterval>('month')

  return (
    <section id="pricing" className="bg-ivory px-4 py-20 md:px-8 md:py-28" aria-labelledby="wewed-pricing-heading">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Simple Wewed pricing</p>
          <h2 id="wewed-pricing-heading" className="wewed-heading mt-4 text-4xl text-espresso md:text-6xl">
            Start free. Upgrade when the wedding operation grows.
          </h2>
          <p className="mt-5 text-sm leading-7 text-espresso/65 md:text-base">
            Transparent USD pricing for couples and wedding professionals. Annual billing includes two months free.
          </p>
          <div className="mt-7 inline-flex rounded-full border border-gold/30 bg-champagne p-1" role="group" aria-label="Billing interval">
            <button
              type="button"
              onClick={() => setInterval('month')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${interval === 'month' ? 'bg-espresso text-gold' : 'text-espresso/65 hover:text-espresso'}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval('year')}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${interval === 'year' ? 'bg-espresso text-gold' : 'text-espresso/65 hover:text-espresso'}`}
            >
              Annual · 2 months free
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {WEWED_PLANS.map((plan) => {
            const Icon = icons[plan.id]
            const cents = interval === 'year' ? plan.annualCents : plan.monthlyCents
            const monthlyEquivalent = interval === 'year' ? annualMonthlyEquivalent(plan) : null
            const registrationPlan = plan.id
            const href = plan.id === 'enterprise'
              ? '/register?plan=enterprise'
              : `/register?plan=${registrationPlan}`

            return (
              <Card
                key={plan.id}
                className={`relative flex h-full flex-col overflow-hidden border-2 ${plan.highlighted ? 'border-gold bg-espresso text-champagne shadow-2xl shadow-gold/10' : 'border-gold/25 bg-champagne/70 text-espresso'}`}
              >
                {plan.highlighted && (
                  <div className="absolute right-4 top-4 rounded-full bg-gold px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-espresso">
                    Best starting point
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className={`flex size-11 items-center justify-center rounded-full border ${plan.highlighted ? 'border-gold/50 bg-gold/10 text-gold' : 'border-gold/35 bg-gold/10 text-gold'}`}>
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="mt-4 text-3xl">{plan.publicName}</CardTitle>
                  <p className={`text-xs font-semibold uppercase tracking-[0.15em] ${plan.highlighted ? 'text-gold' : 'text-gold-dark'}`}>
                    {plan.audience}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <div className="flex items-end gap-2">
                    <span className="font-serif text-5xl leading-none">{formatUsd(cents)}</span>
                    {cents !== null && cents > 0 && (
                      <span className={`pb-1 text-sm ${plan.highlighted ? 'text-champagne/55' : 'text-espresso/55'}`}>
                        /{interval === 'year' ? 'year' : 'month'}
                      </span>
                    )}
                  </div>
                  {monthlyEquivalent !== null && monthlyEquivalent > 0 && (
                    <p className={`mt-2 text-xs ${plan.highlighted ? 'text-champagne/50' : 'text-espresso/50'}`}>
                      Equivalent to {formatUsd(monthlyEquivalent)}/month, billed annually.
                    </p>
                  )}
                  {plan.id === 'enterprise' && (
                    <p className={`mt-2 text-xs ${plan.highlighted ? 'text-champagne/50' : 'text-espresso/50'}`}>
                      Indicative starting price; final scope is agreed during onboarding.
                    </p>
                  )}
                  <p className={`mt-5 text-sm leading-6 ${plan.highlighted ? 'text-champagne/70' : 'text-espresso/65'}`}>
                    {plan.summary}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm leading-5">
                        <Check className="mt-0.5 size-4 shrink-0 text-gold" />
                        <span className={plan.highlighted ? 'text-champagne/85' : 'text-espresso/75'}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-7">
                    <Button asChild className={`w-full ${plan.highlighted ? 'bg-gold text-espresso hover:bg-gold-light' : 'border border-gold/40 bg-transparent text-espresso hover:bg-gold/15'}`}>
                      <a href={href}>
                        {plan.id === 'free' ? 'Start Free' : plan.id === 'enterprise' ? 'Apply for Enterprise' : `Choose ${plan.publicName}`}
                        <ArrowRight className="size-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-espresso/55">
          Registration creates a pending application. Wewed approval and internal onboarding are required before workspace access or paid Checkout. Existing approved Free accounts remain active.
        </p>
      </div>
    </section>
  )
}
