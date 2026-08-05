'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarHeart,
  Camera,
  Check,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Flower2,
  Heart,
  KeyRound,
  MapPin,
  Music2,
  Play,
  Search,
  ShieldCheck,
  Store,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { marketplaceFetch, type PublicPlannerProfile } from '@/components/marketplace/marketplace-types'

const HERO_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/hf_20260804_140303_f8b02a87-f03b-4db5-81e2-969b5f3c3544.mp4'
const EDITORIAL_IMAGE = 'https://d8j0ntlcm91z4.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/hf_20260804_124328_63fdf59b-a32d-498e-853a-27cbefe4ee5b.png'

type PlannerLoadState = 'loading' | 'ready' | 'empty' | 'error'
type HomeSession = {
  authorized?: boolean
  user?: { displayName?: string | null; role?: 'admin' | 'couple' | 'planner' }
  activeWedding?: { slug: string; title: string; date: string; venue: string; venueCity?: string }
}

const roles = [
  { eyebrow: 'For couples', title: 'Your love story, beautifully planned.', detail: 'Private planning, trusted professionals, invitations and everything you need in one place.', href: '/couple', label: 'Start planning', icon: CalendarHeart, position: '50% 42%' },
  { eyebrow: 'For planners', title: 'Grow your business. Delight every couple.', detail: 'Publish your profile, receive enquiries and manage authorised client weddings with confidence.', href: '/for-planners', label: 'Join as a planner', icon: UsersRound, position: '22% 50%' },
  { eyebrow: 'For guests', title: 'Celebrate with ease and confidence.', detail: 'Open your private wedding card, RSVP, view updates and keep every celebration detail close.', href: '/guest-access-help', label: 'Open an invitation', icon: KeyRound, position: '78% 48%' },
] as const

const inspiration = [
  { title: 'A beautiful beginning', category: 'Featured wedding', position: '46% 44%' },
  { title: 'Champagne and candlelight', category: 'Reception style', position: '18% 56%' },
  { title: 'The joy after “I do”', category: 'Real moments', position: '72% 44%' },
  { title: 'A day to remember', category: 'Watch the story', position: '54% 52%', video: true },
] as const

const vendorCategories = [
  { title: 'Venues', category: 'venue', detail: 'Gardens, hotels and destination spaces', icon: Building2, position: '14% 56%' },
  { title: 'Photographers', category: 'photography', detail: 'Stories captured with intention', icon: Camera, position: '28% 48%' },
  { title: 'Florists', category: 'florals', detail: 'Floral artistry for every style', icon: Flower2, position: '46% 48%' },
  { title: 'Caterers', category: 'catering', detail: 'Celebration menus made memorable', icon: UtensilsCrossed, position: '58% 52%' },
  { title: 'Entertainment', category: 'entertainment', detail: 'Music that keeps every table moving', icon: Music2, position: '72% 45%' },
  { title: 'Décor & rentals', category: 'decor-rentals', detail: 'Thoughtful details from aisle to afterparty', icon: Store, position: '86% 52%' },
] as const

function roleDestination(role?: HomeSession['user']['role']): string {
  if (role === 'admin') return '/admin'
  if (role === 'planner') return '/planner'
  return '/couple'
}

export function PublicPlatformHomeV2() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoPaused, setVideoPaused] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [plannerIndex, setPlannerIndex] = useState(0)
  const [inspirationIndex, setInspirationIndex] = useState(0)
  const [planners, setPlanners] = useState<PublicPlannerProfile[]>([])
  const [plannerLoadState, setPlannerLoadState] = useState<PlannerLoadState>('loading')
  const [session, setSession] = useState<HomeSession | null>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (reducedMotion.matches) {
      window.requestAnimationFrame(() => {
        videoRef.current?.pause()
        setVideoPaused(true)
      })
    }

    void Promise.allSettled([
      marketplaceFetch<{ planners: PublicPlannerProfile[] }>('/api/marketplace/planners')
        .then(({ planners: records }) => {
          const published = records.slice(0, 8)
          setPlanners(published)
          setPlannerLoadState(published.length ? 'ready' : 'empty')
        })
        .catch(() => {
          setPlanners([])
          setPlannerLoadState('error')
        }),
      fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
        .then((response) => response.json())
        .then((payload: HomeSession) => setSession(payload))
        .catch(() => setSession({ authorized: false })),
    ])
  }, [])

  const visiblePlanners = planners.length
    ? Array.from({ length: Math.min(4, planners.length) }, (_, offset) => planners[(plannerIndex + offset) % planners.length])
    : []
  const visibleInspiration = Array.from({ length: 4 }, (_, offset) => inspiration[(inspirationIndex + offset) % inspiration.length])
  const liveJourney = Boolean(session?.authorized && session.activeWedding && session.user)
  const journeyTitle = liveJourney ? session?.activeWedding?.title : 'Your wedding journey'
  const journeyLocation = liveJourney
    ? [session?.activeWedding?.venue, session?.activeWedding?.venueCity].filter(Boolean).join(' · ')
    : 'Preview of a signed-in wedding workspace'
  const journeyDate = liveJourney && session?.activeWedding?.date
    ? new Date(session.activeWedding.date).toLocaleDateString(undefined, { dateStyle: 'long' })
    : null

  function toggleVideo() {
    const video = videoRef.current
    if (!video || videoFailed) return
    if (video.paused) {
      void video.play().then(() => setVideoPaused(false)).catch(() => {
        setVideoFailed(true)
        setVideoPaused(true)
      })
    } else {
      video.pause()
      setVideoPaused(true)
    }
  }

  const journeyRows = liveJourney
    ? [
        ['Open your workspace', roleDestination(session?.user?.role), 'Live account and authorised wedding data'],
        ['View wedding site', `/w/${session?.activeWedding?.slug}`, 'Open your active wedding experience'],
        ['Manage invitations', session?.user?.role === 'couple' ? '/couple/invitations' : roleDestination(session?.user?.role), 'Continue in your permitted workspace'],
      ]
    : [
        ['Create your account', '/register', 'Start a private wedding workspace'],
        ['Find a professional', '/planners', 'Browse published marketplace profiles'],
        ['Sign in to see live data', '/sign-in', 'No private wedding details are shown publicly'],
      ]

  return (
    <PublicPlatformShell>
      <section className="relative isolate min-h-[44rem] overflow-hidden bg-espresso text-champagne" data-testid="africa-ready-hero">
        <img src={EDITORIAL_IMAGE} alt="Black bride and groom at an elegant garden wedding" className="absolute inset-0 size-full object-cover object-center" fetchPriority="high" />
        <video
          ref={videoRef}
          className={`absolute inset-0 size-full object-cover object-center transition-opacity duration-500 ${videoFailed ? 'opacity-0' : 'opacity-90'}`}
          src={HERO_VIDEO}
          poster={EDITORIAL_IMAGE}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          onError={() => { setVideoFailed(true); setVideoPaused(true) }}
          aria-label="Black bride and groom dancing together at their wedding reception"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,12,8,0.96)_0%,rgba(18,12,8,0.78)_34%,rgba(18,12,8,0.24)_66%,rgba(18,12,8,0.62)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(216,188,126,0.18),transparent_30%)]" />
        <div className="relative mx-auto grid min-h-[44rem] max-w-[90rem] items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="max-w-2xl wewed-fade-up">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Everything for a beautifully planned wedding</p>
            <h1 className="mt-6 font-serif text-5xl leading-[0.98] sm:text-7xl xl:text-8xl">Plan a wedding as unforgettable as your love.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-champagne/75 sm:text-lg">Wewed connects couples, trusted planners, invited guests and wedding professionals in one private platform—so every celebration can feel beautifully coordinated.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/planners" className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-espresso shadow-xl transition hover:-translate-y-0.5 hover:bg-gold-light"><Search className="size-4" />Find your planner</Link>
              <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-full border border-champagne/30 bg-black/20 px-6 py-3 text-sm text-champagne backdrop-blur transition hover:border-gold hover:text-gold"><CirclePlay className="size-4" />See how it works</Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-champagne/62">
              <div className="flex -space-x-2" aria-hidden="true">{['T', 'N', 'R', 'K'].map((letter) => <span key={letter} className="flex size-8 items-center justify-center rounded-full border-2 border-espresso bg-gradient-to-br from-gold to-clay font-semibold text-espresso">{letter}</span>)}</div>
              <span>Made for couples, planners, guests and wedding professionals.</span>
            </div>
          </div>

          <aside className="relative hidden justify-self-end lg:block" data-testid="wedding-journey-card">
            <div className="w-[23rem] rounded-[2rem] border border-white/20 bg-champagne/95 p-5 text-espresso shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">{liveJourney ? 'Your live wedding workspace' : 'Example wedding journey · preview only'}</p><h2 className="mt-2 font-serif text-2xl">{journeyTitle}</h2></div><Heart className="size-5 text-clay" /></div>
              <p className="mt-1 text-xs text-espresso/55">{journeyLocation}{journeyDate ? ` · ${journeyDate}` : ''}</p>
              <div className="mt-5 flex items-center justify-between text-xs"><span>{liveJourney ? 'Your active workspace' : 'Preview mode'}</span><span className="font-semibold">{liveJourney ? 'Live' : 'Example'}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-espresso/10"><div className={`h-full rounded-full bg-gold ${liveJourney ? 'w-full' : 'w-3/5'}`} /></div>
              <div className="mt-5 space-y-2.5">
                {journeyRows.map(([title, href, detail], index) => (
                  <Link key={title} href={href} className="group flex items-center gap-3 rounded-2xl bg-white/75 p-3 transition hover:bg-white">
                    <span className={`flex size-9 items-center justify-center rounded-full ${index < 2 ? 'bg-sage/15 text-sage' : 'bg-gold/15 text-gold-muted'}`}>{index < 2 ? <Check className="size-4" /> : <UsersRound className="size-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-espresso/50">{detail}</span></span>
                    <ChevronRight className="size-4 text-espresso/30 transition group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
        <button type="button" onClick={toggleVideo} disabled={videoFailed} className="absolute bottom-5 right-5 z-10 flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-4 py-2 text-xs text-white backdrop-blur transition hover:border-gold hover:text-gold disabled:opacity-75" aria-pressed={videoPaused} data-testid="hero-video-control">
          {videoPaused || videoFailed ? <CirclePlay className="size-4" /> : <CirclePause className="size-4" />}
          {videoFailed ? 'Wedding image shown' : videoPaused ? 'Play film' : 'Pause film'}
        </button>
      </section>

      <section className="relative z-10 mx-auto -mt-10 max-w-[90rem] px-4 sm:px-6 lg:px-8" id="couples">
        <div className="grid overflow-hidden rounded-[2rem] border border-gold/15 bg-white shadow-2xl md:grid-cols-3">
          {roles.map(({ eyebrow, title, detail, href, label, icon: Icon, position }) => (
            <Link key={eyebrow} href={href} className="group grid gap-5 border-gold/15 p-5 transition hover:bg-champagne md:border-r md:last:border-r-0 lg:grid-cols-[8.5rem_1fr]">
              <div className="wewed-image-zoom relative min-h-36 overflow-hidden rounded-2xl bg-espresso"><img src={EDITORIAL_IMAGE} alt="" className="size-full object-cover opacity-90" style={{ objectPosition: position }} loading="lazy" /><span className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-espresso/75 text-gold backdrop-blur"><Icon className="size-4" /></span></div>
              <div className="self-center"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-muted">{eyebrow}</p><h2 className="mt-2 font-serif text-2xl leading-tight">{title}</h2><p className="mt-3 text-xs leading-5 text-espresso/58">{detail}</p><span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-gold-muted group-hover:text-espresso">{label}<ArrowRight className="size-3.5" /></span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="featured-planners-title">
        <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Verified professional support</p><h2 id="featured-planners-title" className="mt-3 font-serif text-4xl sm:text-5xl">Find your perfect planner.</h2><p className="mt-3 text-sm text-espresso/60">Published profiles from the real Wewed marketplace—curated for your service needs and celebration style.</p></div><div className="flex items-center gap-2"><button type="button" aria-label="Previous featured planners" disabled={planners.length < 2} onClick={() => setPlannerIndex((current) => planners.length ? (current - 1 + planners.length) % planners.length : 0)} className="flex size-11 items-center justify-center rounded-full border border-gold/25 bg-white disabled:opacity-40"><ArrowLeft className="size-4" /></button><button type="button" aria-label="Next featured planners" disabled={planners.length < 2} onClick={() => setPlannerIndex((current) => planners.length ? (current + 1) % planners.length : 0)} className="flex size-11 items-center justify-center rounded-full border border-gold/25 bg-white disabled:opacity-40"><ArrowRight className="size-4" /></button><Link href="/planners" className="ml-2 text-sm font-semibold text-gold-muted">View all planners</Link></div></div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4" data-testid="featured-planner-carousel" aria-live="polite" aria-busy={plannerLoadState === 'loading'}>
          {plannerLoadState === 'loading' && Array.from({ length: 4 }, (_, index) => <article key={index} className="overflow-hidden rounded-3xl border border-gold/15 bg-white"><div className="h-36 animate-pulse bg-espresso/10" /><div className="space-y-3 p-5"><div className="h-6 w-2/3 animate-pulse rounded-full bg-espresso/10" /><div className="h-3 w-full animate-pulse rounded-full bg-espresso/10" /><div className="h-10 animate-pulse rounded-full bg-gold/10" /></div></article>)}
          {(plannerLoadState === 'empty' || plannerLoadState === 'error') && <div role="status" className="rounded-3xl border border-gold/20 bg-champagne/60 p-8 text-center md:col-span-2 xl:col-span-4"><UsersRound className="mx-auto size-7 text-gold-muted" /><h3 className="mt-4 font-serif text-2xl">{plannerLoadState === 'error' ? 'Planner profiles are temporarily unavailable.' : 'Published planner profiles are coming soon.'}</h3><p className="mt-2 text-sm text-espresso/65">We never substitute test accounts or fabricated profiles for real marketplace data.</p></div>}
          {plannerLoadState === 'ready' && visiblePlanners.map((planner, cardIndex) => <article key={`${planner.id}-${cardIndex}`} className="wewed-card-hover overflow-hidden rounded-3xl border border-gold/20 bg-white shadow-sm"><div className="relative h-36 overflow-hidden bg-gradient-to-br from-espresso via-plum to-clay p-5 text-champagne"><span className="relative flex size-14 items-center justify-center rounded-full border border-gold/30 bg-champagne font-serif text-2xl text-espresso">{planner.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span></div><div className="p-5"><h3 className="font-serif text-2xl">{planner.displayName}</h3><p className="mt-1 line-clamp-2 text-sm text-espresso/58">{planner.headline || 'Wedding planning professional'}</p><p className="mt-4 flex items-center gap-2 text-xs text-espresso/60"><MapPin className="size-3.5 text-gold-muted" />{planner.serviceAreas.join(', ') || 'Service area by consultation'}</p><div className="mt-4 flex flex-wrap gap-1.5">{planner.services.slice(0, 3).map((service) => <span key={service} className="rounded-full bg-champagne px-2.5 py-1 text-[10px]">{service}</span>)}</div><Link href={`/planners/${planner.slug}`} className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-gold/30 px-4 py-2.5 text-xs font-semibold">View profile <ArrowRight className="size-3.5" /></Link></div></article>)}
        </div>
      </section>

      <section className="bg-espresso px-4 py-16 text-champagne sm:px-6" aria-labelledby="inspiration-title">
        <div className="mx-auto max-w-[90rem]"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Wedding inspiration</p><h2 id="inspiration-title" className="mt-3 font-serif text-4xl sm:text-5xl">Wedding inspiration with a heartbeat.</h2></div><div className="flex gap-2"><button type="button" aria-label="Previous inspiration" onClick={() => setInspirationIndex((current) => (current - 1 + inspiration.length) % inspiration.length)} className="flex size-10 items-center justify-center rounded-full border border-gold/30 text-gold"><ArrowLeft className="size-4" /></button><button type="button" aria-label="Next inspiration" onClick={() => setInspirationIndex((current) => (current + 1) % inspiration.length)} className="flex size-10 items-center justify-center rounded-full border border-gold/30 text-gold"><ArrowRight className="size-4" /></button></div></div><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="wedding-inspiration-carousel">{visibleInspiration.map((item, index) => <article key={`${item.title}-${index}`} className="wewed-image-zoom group relative min-h-72 overflow-hidden rounded-3xl border border-white/10 bg-black"><img src={EDITORIAL_IMAGE} alt={item.title} className="absolute inset-0 size-full object-cover opacity-80" style={{ objectPosition: item.position }} loading="lazy" /><div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />{item.video && <span className="absolute left-1/2 top-1/2 flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/45 backdrop-blur"><Play className="ml-1 size-5 fill-white" /></span>}<div className="absolute inset-x-0 bottom-0 p-5"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">{item.category}</p><h3 className="mt-2 font-serif text-2xl">{item.title}</h3></div></article>)}</div></div>
      </section>

      <section id="vendors" className="mx-auto max-w-[90rem] px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="vendors-title">
        <div className="flex flex-wrap items-end justify-between gap-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Find wedding services</p><h2 id="vendors-title" className="mt-3 font-serif text-4xl sm:text-5xl">Professionals who bring the vision to life.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-espresso/60">Choose a service to browse approved public company profiles. Wedding-specific vendor records remain private inside each authorised workspace.</p></div><div className="flex flex-wrap gap-3"><Link href="/vendors" className="rounded-full bg-espresso px-5 py-3 text-sm font-semibold text-champagne">Search all providers</Link><Link href="/vendors/manage" className="rounded-full border border-gold/35 bg-white px-5 py-3 text-sm font-semibold text-gold-muted">Manage company profile</Link></div></div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {vendorCategories.map(({ title, category, detail, icon: Icon, position }) => <Link key={category} href={`/vendors?category=${encodeURIComponent(category)}`} className="wewed-card-hover overflow-hidden rounded-3xl border border-gold/20 bg-white"><div className="wewed-image-zoom relative h-32 overflow-hidden bg-espresso"><img src={EDITORIAL_IMAGE} alt="" className="size-full object-cover opacity-85" style={{ objectPosition: position }} loading="lazy" /><span className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-espresso/80 text-gold backdrop-blur"><Icon className="size-4" /></span></div><div className="p-4"><h3 className="font-serif text-xl">{title}</h3><p className="mt-2 text-xs leading-5 text-espresso/55">{detail}</p><span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-gold-muted">Find {title.toLowerCase()} <ArrowRight className="size-3" /></span></div></Link>)}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-gold/20 bg-champagne p-6"><div className="flex items-start gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-espresso text-gold"><BriefcaseBusiness className="size-5" /></span><div><h3 className="font-serif text-2xl">Offer a wedding service?</h3><p className="mt-2 text-sm text-espresso/60">Register your venue or company, complete Wewed review, then publish and maintain your public profile.</p></div></div><Link href="/register?accountType=vendor" className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-espresso">List your business</Link></div>
      </section>

      <section className="relative overflow-hidden border-y border-gold/15 bg-[linear-gradient(120deg,#fff7f2,#f8eee6,#fbf6ee)] px-4 py-20 sm:px-6">
        <div className="relative mx-auto grid max-w-[90rem] gap-10 lg:grid-cols-[0.85fr_1.15fr]"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Privacy by design</p><h2 className="mt-3 font-serif text-5xl">Love is personal. Your wedding remains yours.</h2><p className="mt-5 max-w-xl text-sm leading-7 text-espresso/65">Wewed can be visually alive without making private lives public. Invitations, planner authority and wedding ownership remain separate, deliberate controls.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
          ['Invitation only', 'Guests enter through scoped private credentials.', KeyRound],
          ['Couple ownership', 'The couple controls every authority decision.', CalendarHeart],
          ['Private spaces', 'Each wedding remains isolated from every other workspace.', ShieldCheck],
          ['Trusted professionals', 'Planner access starts only after explicit authorisation.', UsersRound],
        ].map(([title, detail, Icon]) => <article key={String(title)} className="rounded-3xl border border-gold/20 bg-white/70 p-5 shadow-sm backdrop-blur"><Icon className="size-5 text-gold-muted" /><h3 className="mt-4 font-semibold">{String(title)}</h3><p className="mt-2 text-xs leading-5 text-espresso/58">{String(detail)}</p></article>)}</div></div>
      </section>
    </PublicPlatformShell>
  )
}
