import type { Metadata } from 'next'
import { PublicInfoPage } from '@/components/public/public-info-page'

export const metadata: Metadata = {
  title: 'Wedding Guest Access Help | Wewed',
  description: 'Learn how to use a Wewed wedding invitation QR code or private guest credential.',
}

export default function GuestAccessHelpPage() {
  return (
    <PublicInfoPage
      eyebrow="Invited guest help"
      title="Your invitation is your private entrance."
      description="A wedding site may be public, invitation-only or private. Wewed never lists private couple wedding sites in a public directory."
    >
      <div className="space-y-5">
        {[
          ['Scan the invitation QR', 'Use your phone camera. The QR opens the correct wedding and carries your unique guest credential.'],
          ['Let Wewed verify it', 'The raw credential is exchanged for a secure, wedding-scoped browser session and removed from the visible URL.'],
          ['Review and update your RSVP', 'Your invitation opens only your guest record, including attendance, meals, party details and your message to the couple.'],
          ['Use the same invitation again', 'Return through the original QR when using a new device or after the couple rotates your invitation credential.'],
          ['Respect the couple’s privacy', 'Do not forward the QR or invitation link. The couple or planner can rotate a compromised credential immediately.'],
        ].map(([title, detail]) => (
          <article key={title} className="rounded-2xl border border-gold/20 bg-white p-6"><h2 className="font-serif text-2xl">{title}</h2><p className="mt-2 text-sm leading-6 text-espresso/60">{detail}</p></article>
        ))}
      </div>
    </PublicInfoPage>
  )
}
