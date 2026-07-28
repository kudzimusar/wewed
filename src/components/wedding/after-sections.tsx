'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

/* ── Animation Variants ── */
const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
}

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
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

/* ── Sample Data ── */
const galleryFilters = ['All', 'Ceremony', 'Reception', 'Candid', 'Family']

/**
 * Fallback gallery photos.
 *
 * The after-sections gallery is intentionally a static, fetch-free placeholder.
 * It NEVER makes an API call and therefore NEVER shows an error / "failed to
 * fetch" state — it always renders these sample photos so the AFTER view of
 * the site always feels alive, even before any real media has been uploaded
 * or in the event of a network failure elsewhere.
 */
const GALLERY_PLACEHOLDERS = [
  { id: 'g-1', src: '/hero-wedding.png', caption: 'Imba Manor at golden hour', phase: 'Ceremony' },
  { id: 'g-2', src: '/couple-silhouette.png', caption: 'Charity & Kudzie — the first embrace', phase: 'Candid' },
  { id: 'g-3', src: '/ornament-frame.png', caption: 'Details from the venue', phase: 'Reception' },
  { id: 'g-4', src: '/icon-512.png', caption: 'The wewed monogram — C&K · 23.12.26', phase: 'Family' },
  { id: 'g-5', src: '/hero-wedding.png', caption: 'The celebration begins', phase: 'Reception' },
  { id: 'g-6', src: '/couple-silhouette.png', caption: 'A moment of stillness', phase: 'Candid' },
] as const

const sampleMessages = [
  {
    name: 'Tendai M.',
    message:
      'What a beautiful celebration! Watching Charity and Kudzie say their vows brought tears to my eyes. Makorokoto!',
    time: '2 hours ago',
  },
  {
    name: 'Takudzwa M.',
    message:
      'The best day! So honoured to stand beside my brother. The dance floor was on fire all night!',
    time: '5 hours ago',
  },
  {
    name: 'Rumbidzai C.',
    message:
      'From the ceremony to the last dance, every moment was perfect. Charity, you were absolutely radiant. Love you both!',
    time: '1 day ago',
  },
]

const playedSongs = [
  { title: 'Ave Maria', artist: 'Franz Schubert', time: '2:00 PM', phase: 'Processional' },
  { title: 'Here Comes The Sun', artist: 'The Beatles', time: '2:15 PM', phase: 'Bridal Entrance' },
  { title: 'At Last', artist: 'Etta James', time: '4:30 PM', phase: 'First Dance' },
  { title: 'September', artist: 'Earth, Wind & Fire', time: '5:45 PM', phase: 'Reception' },
  { title: 'Neria', artist: 'Oliver Mtukudzi', time: '6:30 PM', phase: 'Reception' },
  { title: "I Wanna Dance with Somebody", artist: 'Whitney Houston', time: '7:15 PM', phase: 'Reception' },
  { title: 'Chitekete', artist: 'Oliver Mtukudzi', time: '8:00 PM', phase: 'Reception' },
  { title: "Don't Stop Me Now", artist: 'Queen', time: '8:45 PM', phase: 'Reception' },
]

/* ── Recap Section ── */
function RecapSection() {
  return (
    <motion.section
      id="recap"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
          The Day We Said Forever
        </h2>
        <p className="mt-4 font-sans text-muted-foreground">
          Relive the magic of December 23, 2026.
        </p>

        {/* Video Placeholder */}
        <motion.div
          className="mt-12"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="border-plum/30 bg-espresso overflow-hidden shadow-xl">
            <CardContent className="relative flex aspect-video flex-col items-center justify-center gap-4">
              {/* Decorative gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-plum/20 via-espresso to-plum/10" />

              {/* Play Button */}
              <motion.button
                className="relative z-10 flex size-20 items-center justify-center rounded-full border-2 border-plum-light/60 bg-plum/30 backdrop-blur-sm transition-all hover:bg-plum/50 hover:scale-105"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Play highlight reel"
              >
                <Play className="size-8 text-plum-light ml-1" fill="currentColor" />
              </motion.button>

              <p className="relative z-10 wewed-heading text-xl text-champagne/80">
                Highlight Reel
              </p>
              <p className="relative z-10 font-sans text-sm text-champagne/50">
                The full highlight reel will be available here after the wedding.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.section>
  )
}

/* ── Gallery Section ── */
function GallerySection() {
  const [activeFilter, setActiveFilter] = useState('All')

  // Filter the placeholders by phase. Falls back to the full set so the gallery
  // is NEVER empty — defensive guarantee against "no photos" / error states.
  const visiblePhotos =
    activeFilter === 'All'
      ? GALLERY_PLACEHOLDERS
      : GALLERY_PLACEHOLDERS.filter((p) => p.phase === activeFilter)
  const photos = visiblePhotos.length > 0 ? visiblePhotos : GALLERY_PLACEHOLDERS

  return (
    <motion.section
      id="gallery"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            Moments That Matter
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            The photographs that captured our forever.
          </p>
        </div>

        {/* Filter Chips */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {galleryFilters.map((filter) => (
            <button
              key={filter}
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

        {/* Photo Grid — always renders placeholders, never an error state */}
        <motion.div
          className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {photos.map((photo, i) => (
            <motion.div key={photo.id} variants={staggerItem}>
              <Card className="group border-plum/15 bg-champagne overflow-hidden transition-all duration-300 hover:shadow-lg">
                <CardContent className="relative flex aspect-[4/3] items-center justify-center p-0">
                  {/* Real placeholder image — always present */}
                  <img
                    src={photo.src}
                    alt={photo.caption}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {/* Phase badge */}
                  <span className="absolute left-2 top-2 rounded-full bg-plum/85 px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.12em] text-champagne backdrop-blur-sm">
                    {photo.phase}
                  </span>
                  {/* Hover caption */}
                  <div className="absolute inset-0 flex items-end bg-gradient-to-t from-espresso/80 via-espresso/20 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <p className="font-serif text-sm italic leading-snug text-champagne">
                      &ldquo;{photo.caption}&rdquo;
                    </p>
                  </div>
                  {/* Fallback Camera badge if image fails to load — keeps grid populated */}
                  <noscript>
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="size-8 text-plum/30" />
                      <span className="font-sans text-xs text-plum/40">Photo {i + 1}</span>
                    </div>
                  </noscript>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <p className="mt-8 text-center font-sans text-sm text-muted-foreground">
          A preview of the day — full gallery will appear here after December 23, 2026
        </p>
      </div>
    </motion.section>
  )
}

/* ── Playback Section ── */
function PlaybackSection() {
  return (
    <motion.section
      id="playback"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            What We Danced To
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            Every song that played on our day, in order.
          </p>
        </div>

        <motion.div
          className="max-h-[500px] space-y-2 overflow-y-auto wewed-scroll pr-1"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {playedSongs.map((song, i) => (
            <motion.div key={`${song.title}-${i}`} variants={staggerItem}>
              <Card className="border-plum/15 bg-champagne transition-all duration-300 hover:border-plum/30 hover:shadow-md">
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-plum/10">
                    <Disc3 className="size-4 text-plum" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="wewed-heading text-base text-espresso truncate">
                      {song.title}
                    </p>
                    <p className="font-sans text-sm text-muted-foreground truncate">
                      {song.artist}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant="secondary"
                      className="border-plum/20 bg-plum/10 font-sans text-xs text-plum"
                    >
                      {song.phase}
                    </Badge>
                    <span className="font-sans text-xs text-muted-foreground">
                      Played at {song.time}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  )
}

/* ── Guest Wall Section ── */
function GuestWallSection() {
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim() || !name.trim()) return
    setSubmitted(true)
    setMessage('')
    setName('')
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <motion.section
      id="guestwall"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            Words From Our Loved Ones
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            Messages and memories from those who celebrated with us.
          </p>
        </div>

        {/* Message Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-8 border-plum/20 bg-champagne shadow-md">
            <CardContent className="py-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-4 text-plum" />
                  <p className="font-sans text-sm font-medium text-espresso">
                    Leave a Message
                  </p>
                </div>
                <Input
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-plum/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-plum focus:ring-plum/20"
                />
                <Textarea
                  placeholder="Share a memory, wish, or words of love..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[80px] resize-none border-plum/30 bg-white/80 font-sans placeholder:text-muted-foreground/60 focus:border-plum focus:ring-plum/20"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="bg-plum text-champagne hover:bg-plum-light font-sans"
                >
                  <Send className="size-3.5" />
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
            </CardContent>
          </Card>
        </motion.div>

        {/* Messages List */}
        <motion.div
          className="space-y-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {sampleMessages.map((msg, i) => (
            <motion.div key={i} variants={staggerItem}>
              <Card className="border-plum/10 bg-white/60 transition-all duration-300 hover:border-plum/20 hover:shadow-sm">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-plum/10">
                      <span className="wewed-heading text-sm text-plum">
                        {msg.name.charAt(0)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-sans text-sm font-medium text-espresso">
                          {msg.name}
                        </p>
                        <span className="font-sans text-xs text-muted-foreground">
                          &middot; {msg.time}
                        </span>
                      </div>
                      <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                        {msg.message}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  )
}

/* ── Keepsakes Section ── */
function KeepsakesSection() {
  return (
    <motion.section
      id="keepsakes"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <h2 className="wewed-heading wewed-heading-accent text-4xl md:text-5xl text-espresso">
            Take This Day With You
          </h2>
          <p className="mt-4 font-sans text-muted-foreground">
            Download, save, and cherish these memories forever.
          </p>
        </div>

        <motion.div
          className="grid gap-6 sm:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {/* Download Programme */}
          <motion.div variants={staggerItem}>
            <Card className="border-plum/20 bg-champagne transition-all duration-300 hover:shadow-lg h-full">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-plum/10">
                  <Download className="size-6 text-plum" />
                </div>
                <div className="space-y-1">
                  <p className="wewed-heading text-xl text-espresso">
                    Wedding Programme
                  </p>
                  <p className="font-sans text-sm text-muted-foreground">
                    Download the full programme as a PDF keepsake.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-plum/30 text-plum hover:bg-plum/10 font-sans"
                >
                  <Download className="size-4" />
                  Download PDF
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Download Photos */}
          <motion.div variants={staggerItem}>
            <Card className="border-plum/20 bg-champagne transition-all duration-300 hover:shadow-lg h-full">
              <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-plum/10">
                  <Camera className="size-6 text-plum" />
                </div>
                <div className="space-y-1">
                  <p className="wewed-heading text-xl text-espresso">
                    Photo Gallery
                  </p>
                  <p className="font-sans text-sm text-muted-foreground">
                    Download your favourite photos from the day.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-plum/30 text-plum hover:bg-plum/10 font-sans"
                >
                  <Camera className="size-4" />
                  Browse Photos
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Merch Teaser */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8"
        >
          <Card className="border-gold/30 bg-espresso overflow-hidden shadow-lg">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <Gift className="size-8 text-gold" />
              <div className="space-y-2">
                <p className="wewed-heading text-2xl text-champagne">
                  Coming Soon
                </p>
                <p className="font-sans text-champagne/70">
                  Mr &amp; Mrs Musarurwa Keepsakes
                </p>
                <p className="font-sans text-xs text-champagne/50">
                  Candles, mugs, monogram prints &amp; more — stay tuned!
                </p>
              </div>
              <Badge className="border-gold/40 bg-gold/20 font-sans text-xs text-gold">
                <Heart className="size-3" fill="currentColor" />
                C&amp;K &middot; 23.12.26
              </Badge>
            </CardContent>
          </Card>
        </motion.div>

        {/* Thank You Note */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Separator className="mx-auto w-24 bg-plum/20" />
          <div className="mt-8 space-y-4">
            <p className="wewed-heading text-2xl text-espresso">
              With All Our Love
            </p>
            <p className="mx-auto max-w-lg font-sans text-muted-foreground leading-relaxed">
              To everyone who made December 23, 2026 the most beautiful day of our
              lives — thank you. Your love, your laughter, and your presence made
              it perfect. We carry you in our hearts, always.
            </p>
            <p className="wewed-monogram text-sm tracking-widest text-plum">
              Charity &amp; Kudzie Musarurwa
            </p>
          </div>
        </motion.div>
      </div>
    </motion.section>
  )
}

/* ── Main After Sections Component ── */
export function AfterSections() {
  const { lifecycle } = useWewedStore()

  if (lifecycle !== 'after') return null

  return (
    <div className="relative">
      {/* Decorative plum gradient transition */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-plum/5 to-transparent pointer-events-none" />

      <RecapSection />
      <div className="wewed-divider" />
      <GallerySection />
      <div className="wewed-divider" />
      <PlaybackSection />
      <div className="wewed-divider" />
      <GuestWallSection />
      <div className="wewed-divider" />
      <KeepsakesSection />
    </div>
  )
}
