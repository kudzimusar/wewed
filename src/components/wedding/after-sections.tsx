'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import {
  Play,
  Camera,
  Disc3,
  MessageSquare,
  Download,
  Heart,
  Gift,
  Send,
  Loader2,
  Lock,
} from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import {
  compactWeddingDate,
  coupleNames,
  formatWeddingDate,
} from '@/lib/wedding-template-defaults'

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
}

const galleryFilters = ['All', 'Ceremony', 'Reception', 'Candid', 'Family'] as const

type GalleryFilter = (typeof galleryFilters)[number]

interface WallMessage {
  id: string
  authorName: string
  content: string
  createdAt: string
}

function timeAgo(iso: string): string {
  const timestamp = new Date(iso).getTime()
  if (Number.isNaN(timestamp)) return ''
  const diff = Math.max(0, Date.now() - timestamp)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function RecapSection() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const names = coupleNames(wedding)
  const heading =
    ctx?.getContent('after', 'heading', 'The Day We Said Forever') ??
    'The Day We Said Forever'
  const subtitle =
    ctx?.getContent(
      'after',
      'subtitle',
      wedding?.date
        ? `Relive the magic of ${formatWeddingDate(wedding.date)}.`
        : 'Relive the magic of the celebration.',
    ) ?? 'Relive the magic of the celebration.'
  const highlightUrl = ctx?.getContent('after', 'highlightVideoUrl', '') ?? ''

  return (
    <motion.section
      id="recap"
      data-classic-section="after-recap"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">
          {heading}
        </h2>
        <p className="mt-4 font-sans text-muted-foreground">{subtitle}</p>

        <motion.div
          className="mt-12"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="overflow-hidden border-plum/30 bg-espresso shadow-xl">
            <CardContent className="relative flex aspect-video flex-col items-center justify-center gap-4">
              <div className="absolute inset-0 bg-gradient-to-br from-plum/20 via-espresso to-plum/10" />

              {highlightUrl ? (
                <video
                  controls
                  preload="metadata"
                  className="absolute inset-0 size-full object-cover"
                  aria-label={`${names} wedding highlight reel`}
                >
                  <source src={highlightUrl} />
                </video>
              ) : (
                <>
                  <motion.span
                    className="relative z-10 flex size-20 items-center justify-center rounded-full border-2 border-plum-light/60 bg-plum/30 backdrop-blur-sm"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    aria-hidden="true"
                  >
                    <Play className="ml-1 size-8 text-plum-light" fill="currentColor" />
                  </motion.span>
                  <p className="relative z-10 wewed-heading text-xl text-champagne/80">
                    Highlight Reel
                  </p>
                  <p className="relative z-10 max-w-lg px-6 font-sans text-sm text-champagne/50">
                    The official film for {names} can be published here when it is ready.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.section>
  )
}

function GallerySection() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const names = coupleNames(wedding)
  const date = compactWeddingDate(wedding?.date)
  const venue = wedding?.venue || 'the venue'
  const [activeFilter, setActiveFilter] = useState<GalleryFilter>('All')

  const photos = useMemo(() => {
    if (!ctx) return []
    const sources = [
      ctx.getContent('gallery', 'previewImage0', ''),
      ctx.getContent('gallery', 'previewImage1', ''),
      ctx.getContent('gallery', 'previewImage2', ''),
      ctx.getContent('gallery', 'previewImage3', ''),
      ctx.getContent('hero', 'imageUrl', ''),
      ctx.getContent('story', 'familyImageUrl', ''),
    ].filter(Boolean)

    if (sources.length === 0) return []

    const phases = ['Ceremony', 'Candid', 'Reception', 'Family', 'Reception', 'Candid'] as const
    const captions = [
      `${venue} at golden hour`,
      `${names} — a favourite moment`,
      'Details from the celebration',
      date ? `${names} · ${date}` : `${names} · together`,
      'The celebration begins',
      'A moment of stillness',
    ]

    const count = Math.min(6, Math.max(sources.length, sources.length >= 2 ? 6 : 3))
    return Array.from({ length: count }, (_, index) => ({
      id: `after-preview-${index}`,
      src: sources[index % sources.length],
      caption: captions[index],
      phase: phases[index],
    }))
  }, [ctx, date, names, venue])

  const visible =
    activeFilter === 'All'
      ? photos
      : photos.filter((photo) => photo.phase === activeFilter)
  const displayed = visible.length > 0 ? visible : photos

  return (
    <motion.section
      id="after-gallery"
      data-classic-section="after-gallery"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">
            Moments That Matter
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            The photographs that captured {names}&apos; forever.
          </p>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {galleryFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-all duration-200 ${
                activeFilter === filter
                  ? 'bg-plum text-champagne shadow-sm'
                  : 'border border-plum/20 bg-transparent text-espresso hover:bg-plum/10'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {displayed.length > 0 ? (
          <motion.div
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {displayed.map((photo, index) => (
              <motion.div key={photo.id} variants={staggerItem}>
                <Card className="group overflow-hidden border-plum/15 bg-champagne transition-all duration-300 hover:shadow-lg">
                  <CardContent className="relative flex aspect-[4/3] items-center justify-center p-0">
                    <img
                      src={photo.src}
                      alt={photo.caption}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <span className="absolute left-2 top-2 rounded-full bg-plum/85 px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.12em] text-champagne backdrop-blur-sm">
                      {photo.phase}
                    </span>
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-espresso/80 via-espresso/20 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <p className="font-serif text-sm italic leading-snug text-champagne">
                        &ldquo;{photo.caption}&rdquo;
                      </p>
                    </div>
                    <noscript>
                      <div className="flex flex-col items-center gap-2">
                        <Camera className="size-8 text-plum/30" />
                        <span className="font-sans text-xs text-plum/40">Photo {index + 1}</span>
                      </div>
                    </noscript>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="border-dashed border-plum/20 bg-champagne/60">
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Camera className="size-9 text-plum/35" />
              <p className="mt-4 wewed-heading text-xl text-espresso">The first photographs are still to come</p>
              <p className="mt-2 max-w-md font-sans text-sm text-muted-foreground">
                Published wedding media will fill this classic gallery as it is added to {names}&apos; wedding.
              </p>
            </CardContent>
          </Card>
        )}

        <p className="mt-8 text-center font-sans text-sm text-muted-foreground">
          {wedding?.date
            ? `The full wedding-scoped gallery remains available around ${formatWeddingDate(wedding.date)}.`
            : 'The full wedding-scoped gallery remains available below.'}
        </p>
      </div>
    </motion.section>
  )
}

function PlaybackSection() {
  const ctx = useWeddingContextSafe()
  const songs = (ctx?.songs ?? []).slice(0, 12)

  return (
    <motion.section
      id="playback"
      data-classic-section="after-playback"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">
            What We Danced To
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            Every song becomes part of the memory of the day.
          </p>
        </div>

        {songs.length > 0 ? (
          <motion.div
            className="max-h-[500px] space-y-2 overflow-y-auto pr-1 wewed-scroll"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {songs.map((song) => {
              const played = song.playedAt
                ? new Date(song.playedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : null
              const phase = song.moment || song.phase.replaceAll('_', ' ')
              return (
                <motion.div key={song.id} variants={staggerItem}>
                  <Card className="border-plum/15 bg-champagne transition-all duration-300 hover:border-plum/30 hover:shadow-md">
                    <CardContent className="flex items-center gap-4 py-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-plum/10">
                        <Disc3 className="size-4 text-plum" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="wewed-heading truncate text-base text-espresso">{song.title}</p>
                        <p className="truncate font-sans text-sm text-muted-foreground">{song.artist}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge
                          variant="secondary"
                          className="border-plum/20 bg-plum/10 font-sans text-xs capitalize text-plum"
                        >
                          {phase}
                        </Badge>
                        <span className="font-sans text-xs text-muted-foreground">
                          {played ? `Played at ${played}` : 'Saved to the wedding soundtrack'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <Card className="border-dashed border-plum/25 bg-champagne/60">
            <CardContent className="py-8 text-center">
              <Disc3 className="mx-auto size-7 text-plum/50" />
              <p className="mt-3 font-sans text-sm text-muted-foreground">
                The wedding soundtrack will appear here as songs are saved.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.section>
  )
}

function GuestWallSection({ canPost }: { canPost: boolean }) {
  const ctx = useWeddingContextSafe()
  const [messages, setMessages] = useState<WallMessage[]>([])
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const loadMessages = useCallback(async () => {
    if (!ctx?.slug) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/messages?slug=${encodeURIComponent(ctx.slug)}`,
        { cache: 'no-store' },
      )
      const body = (await response.json().catch(() => null)) as {
        success?: boolean
        data?: WallMessage[]
        error?: string
      } | null
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Unable to load wedding messages.')
      }
      setMessages(Array.isArray(body.data) ? body.data : [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load wedding messages.')
    } finally {
      setLoading(false)
    }
  }, [ctx?.slug])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canPost || !message.trim() || !ctx?.slug) return
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: ctx.slug,
          type: 'wall',
          content: message.trim(),
          authorName: name.trim() || 'Guest',
        }),
      })
      const body = (await response.json().catch(() => null)) as {
        success?: boolean
        data?: WallMessage
        error?: string
      } | null
      if (!response.ok || !body?.success || !body.data) {
        throw new Error(body?.error || 'Unable to add your message.')
      }
      setMessages((current) => [body.data as WallMessage, ...current])
      setMessage('')
      setName('')
      setSubmitted(true)
      window.setTimeout(() => setSubmitted(false), 3000)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add your message.')
    } finally {
      setSending(false)
    }
  }

  return (
    <motion.section
      id="guestwall"
      data-classic-section="after-guest-wall"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">
            Words From Our Loved Ones
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            Messages and memories from those who celebrated with us.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-8 border-plum/20 bg-champagne shadow-md">
            <CardContent className="py-4">
              {canPost ? (
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-plum" />
                    <p className="font-sans text-sm font-medium text-espresso">Leave a Message</p>
                  </div>
                  <Input
                    placeholder="Your name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="border-plum/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-plum focus:ring-plum/20"
                  />
                  <Textarea
                    placeholder="Share a memory, wish, or words of love..."
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    className="min-h-[80px] resize-none border-plum/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-plum focus:ring-plum/20"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sending || !message.trim()}
                    className="bg-plum font-sans text-champagne hover:bg-plum-light"
                  >
                    {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                    Post Message
                  </Button>
                  {submitted && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="font-sans text-sm text-sage"
                    >
                      Thank you! Your message has been posted.
                    </motion.p>
                  )}
                </form>
              ) : (
                <div className="flex items-center justify-center gap-2 py-3 text-center font-sans text-sm text-muted-foreground">
                  <Lock className="size-4 text-plum" />
                  Posting opens through a verified invitation; the public wall remains readable here.
                </div>
              )}
              {error && <p className="mt-3 font-sans text-xs text-clay">{error}</p>}
            </CardContent>
          </Card>
        </motion.div>

        {loading ? (
          <div className="flex min-h-28 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-plum" />
          </div>
        ) : messages.length > 0 ? (
          <motion.div
            className="space-y-4"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {messages.slice(0, 12).map((wallMessage) => (
              <motion.div key={wallMessage.id} variants={staggerItem}>
                <Card className="border-plum/10 bg-white/60 transition-all duration-300 hover:border-plum/20 hover:shadow-sm">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-plum/10">
                        <span className="wewed-heading text-sm text-plum">
                          {wallMessage.authorName.charAt(0).toUpperCase() || 'G'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-sans text-sm font-medium text-espresso">{wallMessage.authorName}</p>
                          <span className="font-sans text-xs text-muted-foreground">
                            &middot; {timeAgo(wallMessage.createdAt)}
                          </span>
                        </div>
                        <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                          {wallMessage.content}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="border-dashed border-plum/20 bg-white/40">
            <CardContent className="py-8 text-center">
              <Heart className="mx-auto size-6 text-plum/40" />
              <p className="mt-3 font-sans text-sm text-muted-foreground">The first public message is still waiting to be written.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.section>
  )
}

function KeepsakesSection() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const names = coupleNames(wedding)
  const surname = wedding?.couple.surname?.trim()
  const keepsakeName =
    ctx?.getContent(
      'merch',
      'afterHeading',
      surname ? `${surname} Family Keepsakes` : `${names} Keepsakes`,
    ) ?? (surname ? `${surname} Family Keepsakes` : `${names} Keepsakes`)
  const thankYou =
    ctx?.getContent(
      'after',
      'thankYou',
      wedding?.date
        ? `To everyone who made ${formatWeddingDate(wedding.date)} so beautiful — thank you. Your love, laughter and presence became part of this story, and we carry it with us always.`
        : 'To everyone who made the celebration so beautiful — thank you. Your love, laughter and presence became part of this story, and we carry it with us always.',
    ) ?? 'Thank you for being part of this wedding story.'
  const footerMark = [wedding?.monogram || names, compactWeddingDate(wedding?.date)]
    .filter(Boolean)
    .join(' · ')

  return (
    <motion.section
      id="keepsakes"
      data-classic-section="after-keepsakes"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">
            Take This Day With You
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            Save, revisit and cherish these memories long after the celebration.
          </p>
        </div>

        <motion.div
          className="grid gap-6 sm:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.div variants={staggerItem}>
            <Card className="h-full border-plum/20 bg-champagne transition-all duration-300 hover:shadow-lg">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-plum/10">
                  <Download className="size-6 text-plum" />
                </div>
                <div className="space-y-1">
                  <p className="wewed-heading text-xl text-espresso">Wedding Programme</p>
                  <p className="font-sans text-sm text-muted-foreground">
                    Return to the programme and soundtrack saved for this wedding.
                  </p>
                </div>
                <Button asChild variant="outline" className="border-plum/30 font-sans text-plum hover:bg-plum/10">
                  <a href="#playback">
                    <Download className="size-4" />
                    View Programme Memories
                  </a>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={staggerItem}>
            <Card className="h-full border-plum/20 bg-champagne transition-all duration-300 hover:shadow-lg">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-plum/10">
                  <Camera className="size-6 text-plum" />
                </div>
                <div className="space-y-1">
                  <p className="wewed-heading text-xl text-espresso">Photo Gallery</p>
                  <p className="font-sans text-sm text-muted-foreground">
                    Browse the wedding-scoped photographs and films from the day.
                  </p>
                </div>
                <Button asChild variant="outline" className="border-plum/30 font-sans text-plum hover:bg-plum/10">
                  <a href="#gallery">
                    <Camera className="size-4" />
                    Browse Photos
                  </a>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8"
        >
          <Card className="overflow-hidden border-gold/30 bg-espresso shadow-lg">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <Gift className="size-8 text-gold" />
              <div className="space-y-2">
                <p className="wewed-heading text-2xl text-champagne">Coming Soon</p>
                <p className="font-sans text-champagne/70">{keepsakeName}</p>
                <p className="font-sans text-xs text-champagne/50">
                  Candles, mugs, monogram prints &amp; more — stay tuned!
                </p>
              </div>
              {footerMark && (
                <Badge className="border-gold/40 bg-gold/20 font-sans text-xs text-gold">
                  <Heart className="size-3" fill="currentColor" />
                  {footerMark}
                </Badge>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Separator className="mx-auto w-24 bg-plum/20" />
          <div className="mt-8 space-y-4">
            <p className="wewed-heading text-2xl text-espresso">With All Our Love</p>
            <p className="mx-auto max-w-lg font-sans leading-relaxed text-muted-foreground">
              {thankYou}
            </p>
            <p className="wewed-monogram text-sm tracking-widest text-plum">{names}</p>
          </div>
        </motion.div>
      </div>
    </motion.section>
  )
}

export function AfterSections({ canPost = false }: { canPost?: boolean }) {
  const { lifecycle } = useWewedStore()

  if (lifecycle !== 'after') return null

  return (
    <div className="relative" data-classic-section="after-wedding-suite">
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-32 bg-gradient-to-b from-plum/5 to-transparent" />
      <RecapSection />
      <div className="wewed-divider" />
      <GallerySection />
      <div className="wewed-divider" />
      <PlaybackSection />
      <div className="wewed-divider" />
      <GuestWallSection canPost={canPost} />
      <div className="wewed-divider" />
      <KeepsakesSection />
    </div>
  )
}
