import type { Metadata } from 'next'
import { PublicInfoPage } from '@/components/public/public-info-page'

export const metadata: Metadata = {
  title: 'How Wewed Works',
  description: 'Understand Wewed public discovery, private wedding sites, guest invitations and delegated planner authority.',
}

export default function HowItWorksPage() {
  const steps = [
    ['1', 'Create the wedding', 'The couple owns the wedding, selects privacy and prepares content, guests and planning records.'],
    ['2', 'Invite specific people', 'Unique guest links and QR codes exchange for secure wedding-scoped sessions before content is shown.'],
    ['3', 'Find professional support', 'The public marketplace exposes approved planner profiles without exposing planner accounts or wedding data.'],
    ['4', 'Grant authority separately', 'Planner appointment and wedding authority are distinct. The couple can pause, complete or revoke access.'],
    ['5', 'Preserve the story', 'The wedding can transition from preparation to celebration and Canon preservation under the couple’s control.'],
  ]
  return (
    <PublicInfoPage
      eyebrow="How Wewed works"
      title="Connected journeys with deliberate access boundaries."
      description="A visitor, invited guest, couple, planner and administrator each see a different, role-appropriate part of Wewed."
      action={{ label: 'Find a planner', href: '/planners' }}
    >
      <div className="space-y-4">
        {steps.map(([number, title, detail]) => (
          <article key={number} className="grid gap-4 rounded-2xl border border-gold/20 bg-white p-6 sm:grid-cols-[3rem_1fr]"><div className="flex size-11 items-center justify-center rounded-full bg-espresso font-semibold text-gold">{number}</div><div><h2 className="font-serif text-2xl">{title}</h2><p className="mt-2 text-sm leading-6 text-espresso/60">{detail}</p></div></article>
        ))}
      </div>
    </PublicInfoPage>
  )
}
