import { ArrowRight, Crown, Gift, Sparkles } from 'lucide-react'

const plans = [
  {
    label: 'Start Free',
    detail: 'Apply for a free couple account.',
    href: '/register?plan=free',
    icon: Gift,
  },
  {
    label: 'Choose Canon',
    detail: 'Apply with the Canon plan selected.',
    href: '/register?plan=starter',
    icon: Crown,
  },
  {
    label: 'Choose Forever',
    detail: 'Apply with the full Forever plan selected.',
    href: '/register?plan=professional',
    icon: Sparkles,
  },
]

export function PricingRegistrationLinks() {
  return (
    <section className="bg-ivory px-4 pb-20 md:px-8 md:pb-28" aria-label="Register for a Wewed plan">
      <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const Icon = plan.icon
          return (
            <a
              key={plan.href}
              href={plan.href}
              className="group flex items-center gap-4 rounded-2xl border border-gold/30 bg-champagne/70 p-5 text-espresso shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-lg"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{plan.label}</span>
                <span className="mt-1 block text-xs text-espresso/60">{plan.detail}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-gold transition group-hover:translate-x-1" />
            </a>
          )
        })}
      </div>
      <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-5 text-espresso/55">
        Registration creates a pending application. Wewed approval and internal onboarding are required before workspace access or Stripe payment.
      </p>
    </section>
  )
}
