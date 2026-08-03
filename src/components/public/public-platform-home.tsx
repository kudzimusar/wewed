import Link from 'next/link'
import { ArrowRight, CalendarHeart, KeyRound, Search, ShieldCheck, UsersRound } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'

const roles = [
  {
    title: 'Couples',
    detail: 'Create and manage a private wedding site, invitations, planning and professional support.',
    href: '/couple',
    label: 'Open couple dashboard',
    icon: CalendarHeart,
  },
  {
    title: 'Wedding planners',
    detail: 'Manage your published profile, enquiries, appointments and authorized client weddings.',
    href: '/planner',
    label: 'Open planner account',
    icon: UsersRound,
  },
  {
    title: 'Invited guests',
    detail: 'Use the QR code or private credential supplied on your invitation to enter a wedding site.',
    href: '/guest-access-help',
    label: 'Guest access help',
    icon: KeyRound,
  },
] as const

export function PublicPlatformHome() {
  return (
    <PublicPlatformShell>
      <section className="relative overflow-hidden bg-espresso px-4 py-20 text-champagne sm:px-6 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(191,155,95,0.24),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">One wedding platform · clear privacy boundaries</p>
          <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-tight sm:text-7xl">Plan the wedding. Invite the right people. Preserve it forever.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-champagne/65 sm:text-lg">Wewed connects private couple wedding sites, invitation-only guest access and a public planner marketplace without exposing one space inside another.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/planners" className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-espresso transition hover:bg-gold-light">
              <Search className="size-4" /> Find a planner
            </Link>
            <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-full border border-gold/35 px-6 py-3 text-sm text-gold transition hover:bg-gold/10">
              How Wewed works <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {roles.map(({ title, detail, href, label, icon: Icon }) => (
            <article key={title} className="rounded-3xl border border-gold/20 bg-champagne p-7 shadow-sm">
              <div className="flex size-12 items-center justify-center rounded-full border border-gold/25 bg-gold/10"><Icon className="size-5 text-gold-muted" /></div>
              <h2 className="mt-5 font-serif text-3xl">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-espresso/60">{detail}</p>
              <Link href={href} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-muted hover:text-espresso">{label}<ArrowRight className="size-4" /></Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-gold/20 bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Privacy by role</p>
            <h2 className="mt-3 font-serif text-4xl">A public marketplace is not a public wedding.</h2>
            <p className="mt-4 text-sm leading-7 text-espresso/65">Published planner profiles are deliberately public. Couple wedding sites are separately configured as public, invitation-only or private. Planner appointment never changes a wedding’s privacy.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gold/20 p-5"><ShieldCheck className="size-5 text-gold-muted" /><h3 className="mt-3 font-semibold">Invitation sessions</h3><p className="mt-2 text-sm text-espresso/60">Guest QR credentials become scoped, secure sessions before wedding content is delivered.</p></div>
            <div className="rounded-2xl border border-gold/20 p-5"><CalendarHeart className="size-5 text-gold-muted" /><h3 className="mt-3 font-semibold">Couple ownership</h3><p className="mt-2 text-sm text-espresso/60">The couple retains wedding ownership, subscription control and all authority decisions.</p></div>
          </div>
        </div>
      </section>
    </PublicPlatformShell>
  )
}
