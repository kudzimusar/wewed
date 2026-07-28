'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  Heart,
  Music,
  Star,
  Sparkles,
  MessageCircle,
  Loader2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { SectionInfo } from '@/components/wedding/section-info'

/* ============================================================
   ContributionGallery — public "Meet Our Village" display
   ------------------------------------------------------------
   Section id="village"
   Fetches GET /api/contributions/public
   Renders approved/featured contributions in a masonry grid
   using CSS columns. Filter chips at top, framer-motion
   staggered reveal, responsive 1/2/3 columns.
   ============================================================ */

type ContributionType = 'memory' | 'advice' | 'blessing' | 'funny_story' | 'wish'

interface PublicContribution {
  id: string
  type: ContributionType
  displayName: string
  relationship: string | null
  message: string
  photoUrl: string | null
  favoriteSong: string | null
  privacy: string
  status: string
  wordCount: number
  charCount: number
  createdAt: string
  submittedAt: string | null
}

type FilterKey = 'all' | ContributionType

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'memory', label: 'Memories' },
  { key: 'advice', label: 'Advice' },
  { key: 'blessing', label: 'Blessings' },
  { key: 'funny_story', label: 'Funny Stories' },
  { key: 'wish', label: 'Wishes' },
]

const TYPE_LABELS: Record<ContributionType, string> = {
  memory: 'Memory',
  advice: 'Advice',
  blessing: 'Blessing',
  funny_story: 'Funny Story',
  wish: 'Wish',
}

// Badge color per type
function badgeClassFor(type: ContributionType): string {
  switch (type) {
    case 'memory':
      return 'border-gold/40 bg-gold/15 text-gold'
    case 'advice':
      return 'border-sage/40 bg-sage/15 text-sage-light'
    case 'blessing':
      return 'border-plum/40 bg-plum/15 text-plum-light'
    case 'funny_story':
      return 'border-clay/40 bg-clay/15 text-clay-light'
    case 'wish':
      return 'border-gold-light/50 bg-gold-light/20 text-gold-light'
    default:
      return 'border-gold/30 bg-gold/10 text-gold'
  }
}

function tintFor(type: ContributionType): string {
  switch (type) {
    case 'memory':
      return 'text-gold'
    case 'advice':
      return 'text-sage-light'
    case 'blessing':
      return 'text-plum-light'
    case 'funny_story':
      return 'text-clay-light'
    case 'wish':
      return 'text-gold-light'
    default:
      return 'text-gold'
  }
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const days = Math.floor(diff / 86_400_000)
  if (days < 1) return 'today'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export function ContributionGallery() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const inView = useInView(sectionRef, { once: true, margin: '-80px' })

  const [contributions, setContributions] = useState<PublicContribution[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch('/api/contributions/public', { cache: 'no-store' })
        const json = (await res.json()) as {
          success?: boolean
          data?: PublicContribution[]
        }
        if (!cancelled && json.data) {
          setContributions(json.data)
        }
      } catch {
        /* silent — keep empty state */
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const list =
      filter === 'all'
        ? contributions
        : contributions.filter((c) => c.type === filter)
    // Featured first, then by submittedAt desc
    return [...list].sort((a, b) => {
      const aF = a.status === 'featured' ? 1 : 0
      const bF = b.status === 'featured' ? 1 : 0
      if (aF !== bF) return bF - aF
      const aT = new Date(a.submittedAt ?? a.createdAt).getTime()
      const bT = new Date(b.submittedAt ?? b.createdAt).getTime()
      return bT - aT
    })
  }, [contributions, filter])

  const counts = useMemo(() => {
    const map: Record<FilterKey, number> = {
      all: contributions.length,
      memory: 0,
      advice: 0,
      blessing: 0,
      funny_story: 0,
      wish: 0,
    }
    for (const c of contributions) {
      map[c.type] = (map[c.type] ?? 0) + 1
    }
    return map
  }, [contributions])

  const featuredCount = useMemo(
    () => contributions.filter((c) => c.status === 'featured').length,
    [contributions]
  )

  return (
    <section
      id="village"
      className="wewed-section relative overflow-hidden bg-espresso py-20 md:py-32"
    >
      {/* Decorative gold orbs */}
      <div className="pointer-events-none absolute -top-24 left-1/4 size-72 rounded-full bg-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 size-72 rounded-full bg-plum/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-12 text-center md:mb-16"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1">
            <MessageCircle className="size-3 text-gold" />
            <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-gold-muted">
              Our Village
            </span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-champagne sm:text-4xl md:text-5xl">
            Meet Our Village <SectionInfo text="Each invited guest receives a personal token link to contribute their own memory, blessing, advice, or wish. The couple reviews and approves each submission. Filter by type using the chips above." className="align-middle" />
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-sm tracking-wide text-champagne/60 sm:text-base">
            Stories, blessings, and memories from the people who shape our journey.
          </p>
          {featuredCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1">
              <Star className="size-3 fill-gold text-gold" />
              <span className="font-sans text-[10px] uppercase tracking-wider text-gold">
                {featuredCount} featured contribution{featuredCount === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </motion.div>

        {/* Filter chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mb-10 flex flex-wrap items-center justify-center gap-2"
        >
          {FILTERS.map((f) => {
            const count = counts[f.key] ?? 0
            const active = filter === f.key
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-sans text-[11px] uppercase tracking-wider transition-colors ${
                  active
                    ? 'border-gold/50 bg-gold/20 text-gold'
                    : 'border-champagne/15 text-champagne/60 hover:border-gold/30 hover:text-champagne'
                }`}
                disabled={count === 0 && f.key !== 'all'}
              >
                {f.label}
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${
                    active ? 'bg-gold/30 text-gold' : 'bg-champagne/10 text-champagne/40'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </motion.div>

        {/* Grid / states */}
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
            {filtered.map((c, i) => (
              <ContributionCard key={c.id} contribution={c} index={i} />
            ))}
          </div>
        )}

        {/* Footer note */}
        <p className="mt-12 text-center font-sans text-[10px] tracking-wider text-champagne/30">
          {contributions.length > 0
            ? `${contributions.length} voices · ${contributions.reduce((acc, c) => acc + c.wordCount, 0).toLocaleString()} words of love`
            : 'The village gallery is growing. Check back soon.'}
        </p>
      </div>
    </section>
  )
}

// ─── Single card ─────────────────────────────────────────────────────────────

function ContributionCard({
  contribution: c,
  index,
}: {
  contribution: PublicContribution
  index: number
}) {
  const isFeatured = c.status === 'featured'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{
        duration: 0.5,
        delay: Math.min(index * 0.06, 0.4),
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`break-inside-avoid ${isFeatured ? 'lg:scale-[1.02]' : ''}`}
    >
      <Card
        className={`wewed-photo-frame group relative overflow-hidden rounded-xl border bg-champagne/95 backdrop-blur-sm ${
          isFeatured
            ? 'border-gold/50 shadow-md hover:shadow-gold/10'
            : 'border-gold/25 hover:border-gold/40'
        }`}
      >
        {/* Featured ribbon */}
        {isFeatured && (
          <div className="absolute right-0 top-0 z-10 flex items-center gap-1 rounded-bl-lg bg-gradient-to-l from-gold to-gold-muted px-2.5 py-1">
            <Star className="size-3 fill-espresso text-espresso" />
            <span className="font-sans text-[9px] font-semibold uppercase tracking-wider text-espresso">
              Featured
            </span>
          </div>
        )}

        <CardContent className="p-5 sm:p-6">
          {/* Header: type + age */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <Badge
              className={`border ${badgeClassFor(c.type)} text-[10px] font-medium uppercase tracking-wider`}
            >
              <TypeIcon type={c.type} />
              {TYPE_LABELS[c.type]}
            </Badge>
            {c.submittedAt && (
              <span className="font-sans text-[10px] text-espresso/40">
                {timeAgo(c.submittedAt)}
              </span>
            )}
          </div>

          {/* Author */}
          <h3 className="wewed-heading text-lg font-light text-espresso sm:text-xl">
            {c.displayName}
          </h3>
          {c.relationship && (
            <p className="mt-0.5 font-sans text-xs italic text-espresso/55">
              {c.relationship}
            </p>
          )}

          {/* Optional photo */}
          {c.photoUrl && (
            <div className="mt-3 overflow-hidden rounded-lg border border-gold/20">
              <img
                src={c.photoUrl}
                alt={`Photo shared by ${c.displayName}`}
                className="max-h-72 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          )}

          {/* Message */}
          <div className="mt-3">
            <p className="whitespace-pre-line font-serif text-[15px] leading-relaxed text-espresso/85">
              {c.message}
            </p>
          </div>

          {/* Favorite song */}
          {c.favoriteSong && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-gold/20 bg-gold/5 px-2.5 py-1.5">
              <Music className={`size-3.5 shrink-0 ${tintFor(c.type)}`} />
              <p className="truncate font-sans text-[11px] text-espresso/70">
                <span className="text-espresso/40">Soundtrack · </span>
                <span className="italic">{c.favoriteSong}</span>
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-gold/15 pt-3">
            <span className="font-sans text-[10px] text-espresso/40">
              {c.wordCount} {c.wordCount === 1 ? 'word' : 'words'}
            </span>
            <Heart
              className={`size-3.5 ${tintFor(c.type)} opacity-60 transition-opacity group-hover:opacity-100`}
              strokeWidth={1.5}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function TypeIcon({ type }: { type: ContributionType }) {
  // Use a small mark per type for visual variety
  if (type === 'memory') return <Sparkles className="mr-1 size-3" />
  if (type === 'blessing') return <Heart className="mr-1 size-3" />
  if (type === 'wish') return <Star className="mr-1 size-3" />
  return null
}

// ─── States ──────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>*]:mb-5">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Card key={i} className="break-inside-avoid border-gold/15 bg-champagne/10">
          <CardContent className="space-y-3 p-5">
            <div className="flex justify-between">
              <div className="h-5 w-20 animate-pulse rounded bg-champagne/15" />
              <div className="h-3 w-10 animate-pulse rounded bg-champagne/10" />
            </div>
            <div className="h-5 w-2/3 animate-pulse rounded bg-champagne/15" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-champagne/10" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full animate-pulse rounded bg-champagne/10" />
              <div className="h-3 w-11/12 animate-pulse rounded bg-champagne/10" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-champagne/10" />
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="break-inside-avoid py-8 text-center">
        <Loader2 className="mx-auto size-5 animate-spin text-gold/60" />
        <p className="mt-2 font-sans text-[11px] text-champagne/40">
          Gathering the village…
        </p>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-xl"
    >
      <Card className="border-gold/20 bg-champagne/[0.04] backdrop-blur-sm">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="flex size-16 items-center justify-center rounded-full border border-gold/30 bg-gold/5"
          >
            <Heart className="size-7 text-gold" strokeWidth={1.5} />
          </motion.div>
          <h3 className="wewed-heading text-xl text-champagne sm:text-2xl">
            The village is still gathering
          </h3>
          <p className="font-sans text-sm leading-relaxed text-champagne/60">
            Be the first to share a memory. The couple will share your invitation
            link soon — keep an eye on your inbox.
          </p>
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-2 flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.2em] text-champagne/40"
            >
              <Sparkles className="size-3 text-gold" />
              Every story matters
              <Sparkles className="size-3 text-gold" />
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}
