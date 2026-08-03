import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, CalendarHeart, ShieldCheck, UsersRound } from 'lucide-react'
import { PublicInfoPage } from '@/components/public/public-info-page'

export const metadata: Metadata = {
  title: 'Sign in to Wewed',
  description: 'Choose the Wewed workspace that matches your account role.',
  robots: { index: false, follow: false },
}

const workspaces = [
  ['Couple workspace', 'Manage your wedding, invitations, privacy and planner relationship.', '/couple', CalendarHeart],
  ['Planner workspace', 'Manage your business profile, enquiries, appointments and assigned weddings.', '/planner', UsersRound],
  ['Wewed administration', 'Review onboarding, roles and planner-profile publication.', '/admin', ShieldCheck],
] as const

export default function SignInPage() {
  return (
    <PublicInfoPage
      eyebrow="Secure access"
      title="Choose your Wewed workspace."
      description="Each workspace verifies the signed-in account role before displaying private data."
    >
      <div className="grid gap-5 md:grid-cols-3">
        {workspaces.map(([title, detail, href, Icon]) => (
          <Link key={href} href={href} className="group rounded-2xl border border-gold/20 bg-champagne p-6 transition hover:-translate-y-1 hover:shadow-lg">
            <Icon className="size-6 text-gold-muted" />
            <h2 className="mt-5 font-serif text-2xl">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-espresso/60">{detail}</p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted group-hover:text-espresso"><Building2 className="size-4" />Open workspace</span>
          </Link>
        ))}
      </div>
    </PublicInfoPage>
  )
}
