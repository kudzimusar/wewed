'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Building2, CalendarHeart, Camera, CirclePause, CirclePlay, Flower2, KeyRound, MapPin, Music2, Search, ShieldCheck, Store, UsersRound, UtensilsCrossed } from 'lucide-react'
import { PublicPlatformShell } from '@/components/public/public-platform-shell'
import { marketplaceFetch, type PublicPlannerProfile } from '@/components/marketplace/marketplace-types'

const HERO_VIDEO = 'https://d8j0ntlcm91z4.cloudfront.net/user_3HRETeCH9lBYSVHRJrOseXmNU2z/hf_20260804_140303_f8b02a87-f03b-4db5-81e2-969b5f3c3544.mp4'
const HERO_POSTER = '/media/wewed-couple-hero.svg'

type PlannerLoadState = 'loading' | 'ready' | 'empty' | 'error'

const roles = [
  { eyebrow: 'For couples', title: 'Your love story, beautifully planned.', detail: 'Private planning, trusted professionals, invitations and everything you need in one place.', href: '/couple', label: 'Start planning', image: '/media/wewed-couple-planning.svg', icon: CalendarHeart },
  { eyebrow: 'For planners', title: 'Grow your business. Delight every couple.', detail: 'Publish your profile, receive enquiries and manage authorised client weddings with confidence.', href: '/for-planners', label: 'Join as a planner', image: '/media/wewed-couple-garden.svg', icon: UsersRound },
  { eyebrow: 'For guests', title: 'Celebrate with ease and confidence.', detail: 'Open your private wedding card, RSVP, view updates and keep every celebration detail close.', href: '/guest-access-help', label: 'Open an invitation', image: '/media/wewed-couple-guests.svg', icon: KeyRound },
] as const

const inspiration = [
  { title: 'Garden vows', category: 'Featured wedding', image: '/media/wewed-couple-garden.svg' },
  { title: 'Champagne and candlelight', category: 'Reception style', image: '/media/wewed-couple-reception.svg' },
  { title: 'The joy after “I do”', category: 'Real moments', image: '/media/wewed-couple-celebration.svg' },
  { title: 'A day to remember', category: 'Wedding story', image: '/media/wewed-couple-hero.svg' },
] as const

const vendorCategories = [
  { title: 'Venues', detail: 'Gardens, hotels and destination spaces', icon: Building2, image: '/media/wewed-couple-garden.svg' },
  { title: 'Photographers', detail: 'Stories captured with intention', icon: Camera, image: '/media/wewed-couple-celebration.svg' },
  { title: 'Florists', detail: 'Floral artistry for every style', icon: Flower2, image: '/media/wewed-couple-garden.svg' },
  { title: 'Caterers', detail: 'Celebration menus made memorable', icon: UtensilsCrossed, image: '/media/wewed-couple-reception.svg' },
  { title: 'Entertainment', detail: 'Music that keeps every table moving', icon: Music2, image: '/media/wewed-couple-celebration.svg' },
  { title: 'Décor & rentals', detail: 'Thoughtful details from aisle to afterparty', icon: Store, image: '/media/wewed-couple-planning.svg' },
] as const

export function PublicPlatformHomeV2() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoPaused, setVideoPaused] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [plannerIndex, setPlannerIndex] = useState(0)
  const [inspirationIndex, setInspirationIndex] = useState(0)
  const [planners, setPlanners] = useState<PublicPlannerProfile[]>([])
  const [plannerLoadState, setPlannerLoadState] = useState<PlannerLoadState>('loading')

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.requestAnimationFrame(() => {
        videoRef.current?.pause()
        setVideoPaused(true)
      })
    }
    void marketplaceFetch<{ planners: PublicPlannerProfile[] }>('/api/marketplace/planners')
      .then(({ planners: records }) => {
        const published = records.slice(0, 8)
        setPlanners(published)
        setPlannerLoadState(published.length ? 'ready' : 'empty')
      })
      .catch(() => {
        setPlanners([])
        setPlannerLoadState('error')
      })
  }, [])

  const visiblePlanners = planners.length ? Array.from({ length: Math.min(4, planners.length) }, (_, offset) => planners[(plannerIndex + offset) % planners.length]) : []
  const visibleInspiration = Array.from({ length: 4 }, (_, offset) => inspiration[(inspirationIndex + offset) % inspiration.length])

  function toggleVideo() {
    const video = videoRef.current
    if (!video || videoFailed) return
    if (video.paused) void video.play().then(() => setVideoPaused(false)).catch(() => setVideoFailed(true))
    else {
      video.pause()
      setVideoPaused(true)
    }
  }

  return (
    <PublicPlatformShell>
      <section className="relative isolate min-h-[44rem] overflow-hidden bg-espresso text-champagne" data-testid="africa-ready-hero">
        <img src={HERO_POSTER} alt="Black bride and groom dancing together at their wedding" className="absolute inset-0 size-full object-cover" fetchPriority="high" />
        <video ref={videoRef} className={`absolute inset-0 size-full object-cover transition-opacity ${videoFailed ? 'opacity-0' : 'opacity-80'}`} src={HERO_VIDEO} poster={HERO_POSTER} muted autoPlay loop playsInline preload="metadata" onError={() => { setVideoFailed(true); setVideoPaused(true) }} aria-label="Bride and groom dancing at their wedding" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(18,12,8,0.96),rgba(18,12,8,0.72)_42%,rgba(18,12,8,0.28)_72%,rgba(18,12,8,0.58))]" />
        <div className="relative mx-auto grid min-h-[44rem] max-w-[90rem] items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-gold">Everything for a beautifully planned wedding</p>
            <h1 className="mt-6 font-serif text-5xl leading-[0.98] sm:text-7xl xl:text-8xl">Plan a wedding as unforgettable as your love.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-champagne/80 sm:text-lg">Wewed connects couples, trusted planners, invited guests and wedding professionals in one private, beautifully coordinated place.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/planners" className="inline-flex items-center gap-2 rounded-full bg-gold px-6 py-3 text-sm font-semibold text-espresso"><Search className="size-4" />Find your planner</Link>
              <Link href="/how-it-works" className="inline-flex items-center gap-2 rounded-full border border-champagne/35 bg-black/25 px-6 py-3 text-sm text-champagne"><CirclePlay className="size-4" />See how it works</Link>
            </div>
            <p className="mt-8 text-sm text-champagne/70">Made for couples, planners, guests and the people who bring weddings to life.</p>
          </div>
        </div>
        <button type="button" onClick={toggleVideo} disabled={videoFailed} className="absolute bottom-5 right-5 z-10 flex items-center gap-2 rounded-full border border-white/30 bg-black/45 px-4 py-2 text-xs text-white backdrop-blur disabled:opacity-70" aria-pressed={videoPaused} data-testid="hero-video-control">
          {videoPaused || videoFailed ? <CirclePlay className="size-4" /> : <CirclePause className="size-4" />}
          {videoFailed ? 'Wedding image shown' : videoPaused ? 'Play film' : 'Pause film'}
        </button>
      </section>

      <section className="relative z-10 mx-auto -mt-10 max-w-[90rem] px-4 sm:px-6 lg:px-8" id="couples">
        <div className="grid overflow-hidden rounded-[2rem] border border-gold/15 bg-white shadow-2xl md:grid-cols-3">
          {roles.map(({ eyebrow, title, detail, href, label, image, icon: Icon }) => (
            <Link key={eyebrow} href={href} className="group grid gap-5 border-gold/15 p-5 transition hover:bg-champagne md:border-r md:last:border-r-0 lg:grid-cols-[8.5rem_1fr]">
              <div className="relative min-h-36 overflow-hidden rounded-2xl bg-espresso"><img src={image} alt="" className="size-full object-cover" loading="lazy" /><span className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full bg-espresso/80 text-gold"><Icon className="size-4" /></span></div>
              <div className="self-center"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-muted">{eyebrow}</p><h2 className="mt-2 font-serif text-2xl leading-tight">{title}</h2><p className="mt-3 text-xs leading-5 text-espresso/65">{detail}</p><span className="mt-4 inline-flex text-xs font-semibold text-gold-muted">{label}</span></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[90rem] px-4 py-20 sm:px-6 lg:px-8" aria-labelledby="featured-planners-title">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Professional support</p><h2 id="featured-planners-title" className="mt-3 font-serif text-4xl sm:text-5xl">Find your perfect planner.</h2><p className="mt-3 text-sm text-espresso/65">Published profiles from the real Wewed marketplace.</p></div>
          <div className="flex gap-2"><button aria-label="Previous featured planners" disabled={planners.length < 2} onClick={() => setPlannerIndex((current) => planners.length ? (current - 1 + planners.length) % planners.length : 0)} className="flex size-11 items-center justify-center rounded-full border border-gold/25"><ArrowLeft className="size-4" /></button><button aria-label="Next featured planners" disabled={planners.length < 2} onClick={() => setPlannerIndex((current) => planners.length ? (current + 1) % planners.length : 0)} className="flex size-11 items-center justify-center rounded-full border border-gold/25"><ArrowRight className="size-4" /></button></div>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4" data-testid="featured-planner-carousel" aria-live="polite">
          {plannerLoadState === 'loading' && Array.from({ length: 4 }, (_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl bg-espresso/10" />)}
          {(plannerLoadState === 'empty' || plannerLoadState === 'error') && <div role="status" className="rounded-3xl border border-gold/20 bg-champagne/60 p-8 text-center md:col-span-2 xl:col-span-4"><UsersRound className="mx-auto size-7 text-gold-muted" /><h3 className="mt-4 font-serif text-2xl">{plannerLoadState === 'error' ? 'Planner profiles are temporarily unavailable.' : 'Published planner profiles are coming soon.'}</h3><p className="mt-2 text-sm text-espresso/65">We never substitute test accounts or fabricated profiles for real marketplace data.</p></div>}
          {plannerLoadState === 'ready' && visiblePlanners.map((planner) => <article key={planner.id} className="overflow-hidden rounded-3xl border border-gold/20 bg-white"><div className="bg-espresso p-5 text-champagne"><span className="flex size-14 items-center justify-center rounded-full bg-champagne font-serif text-2xl text-espresso">{planner.displayName.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span></div><div className="p-5"><h3 className="font-serif text-2xl">{planner.displayName}</h3><p className="mt-1 text-sm text-espresso/65">{planner.headline || 'Wedding planning professional'}</p><p className="mt-4 flex items-center gap-2 text-xs text-espresso/65"><MapPin className="size-3.5 text-gold-muted" />{planner.serviceAreas.join(', ') || 'Service area by consultation'}</p><Link href={`/planners/${planner.slug}`} className="mt-5 flex w-full justify-center rounded-full border border-gold/30 px-4 py-2.5 text-xs font-semibold">View profile</Link></div></article>)}
        </div>
      </section>

      <section className="bg-espresso px-4 py-16 text-champagne sm:px-6" aria-labelledby="inspiration-title">
        <div className="mx-auto max-w-[90rem]"><div className="flex items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Wedding inspiration</p><h2 id="inspiration-title" className="mt-3 font-serif text-4xl sm:text-5xl">Beautiful ideas for your celebration.</h2></div><div className="flex gap-2"><button aria-label="Previous inspiration" onClick={() => setInspirationIndex((current) => (current - 1 + inspiration.length) % inspiration.length)} className="flex size-10 items-center justify-center rounded-full border border-gold/30"><ArrowLeft className="size-4" /></button><button aria-label="Next inspiration" onClick={() => setInspirationIndex((current) => (current + 1) % inspiration.length)} className="flex size-10 items-center justify-center rounded-full border border-gold/30"><ArrowRight className="size-4" /></button></div></div><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="wedding-inspiration-carousel">{visibleInspiration.map((item, index) => <article key={`${item.title}-${index}`} className="relative min-h-72 overflow-hidden rounded-3xl border border-white/10"><img src={item.image} alt={item.title} className="absolute inset-0 size-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" /><div className="absolute bottom-0 p-5"><p className="text-[10px] uppercase tracking-[0.16em] text-gold">{item.category}</p><h3 className="mt-2 font-serif text-2xl">{item.title}</h3></div></article>)}</div></div>
      </section>

      <section id="vendors" className="mx-auto max-w-[90rem] px-4 py-20 sm:px-6 lg:px-8"><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-muted">Wedding professionals</p><h2 className="mt-3 font-serif text-4xl sm:text-5xl">Professionals who bring the vision to life.</h2></div><div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{vendorCategories.map(({ title, detail, icon: Icon, image }) => <article key={title} className="relative min-h-64 overflow-hidden rounded-3xl"><img src={image} alt="" className="absolute inset-0 size-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/90 to-black/10" /><div className="absolute bottom-0 p-5 text-white"><Icon className="size-5 text-gold" /><h3 className="mt-3 font-serif text-2xl">{title}</h3><p className="mt-1 text-xs text-white/75">{detail}</p></div></article>)}</div></section>

      <section className="border-y border-gold/15 bg-champagne/55 px-4 py-16 sm:px-6"><div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-[auto_1fr]"><span className="flex size-16 items-center justify-center rounded-full bg-espresso text-gold"><ShieldCheck className="size-7" /></span><div><h2 className="font-serif text-3xl">Your wedding details stay private.</h2><p className="mt-3 text-sm leading-6 text-espresso/65">Couples control access, planners work only with authorised weddings, and guests enter through their private invitation.</p></div></div></section>
    </PublicPlatformShell>
  )
}
