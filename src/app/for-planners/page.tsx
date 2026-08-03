import type { Metadata } from 'next'
import { PublicInfoPage } from '@/components/public/public-info-page'

export const metadata: Metadata = {
  title: 'For Wedding Planners | Wewed',
  description: 'Build a reviewed public profile, receive enquiries and work inside weddings only after explicit couple authorization.',
}

export default function ForPlannersPage() {
  return (
    <PublicInfoPage
      eyebrow="For wedding professionals"
      title="A public profile. A private business account. Authorized client work."
      description="Wewed keeps your professional marketplace presence separate from private enquiries and wedding operations."
      action={{ label: 'Open planner account', href: '/planner' }}
    >
      <div className="grid gap-5 md:grid-cols-3">
        {[
          ['Publish professionally', 'Maintain an approved profile with services, areas, style, availability and portfolio links.'],
          ['Respond privately', 'Receive structured enquiries without receiving access to the couple’s wedding records.'],
          ['Work by authority', 'Enter an operational wedding workspace only after appointment acceptance and the couple’s authority grant.'],
        ].map(([title, detail]) => (
          <article key={title} className="rounded-2xl border border-gold/20 bg-champagne p-6"><h2 className="font-serif text-2xl">{title}</h2><p className="mt-3 text-sm leading-6 text-espresso/60">{detail}</p></article>
        ))}
      </div>
    </PublicInfoPage>
  )
}
