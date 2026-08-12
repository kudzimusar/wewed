'use client'

import { motion, type Variants } from 'framer-motion'
import { Camera, Disc3, Heart, Images, MessageSquare } from 'lucide-react'
import { useWewedStore } from '@/lib/store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import { coupleNames, formatWeddingDate } from '@/lib/wedding-template-defaults'

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
}

function RecapSection() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const names = coupleNames(wedding)
  const heading = ctx?.getContent('after', 'heading', 'The Day We Said Forever') ?? 'The Day We Said Forever'
  const subtitle = ctx?.getContent(
    'after',
    'subtitle',
    wedding?.date ? `Relive the celebration of ${formatWeddingDate(wedding.date)}.` : 'Relive the moments that made the day unforgettable.',
  ) ?? 'Relive the moments that made the day unforgettable.'
  const highlightUrl = ctx?.getContent('after', 'highlightVideoUrl', '') ?? ''

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
        <p className="wewed-monogram mb-4 text-xs uppercase tracking-[0.24em] text-plum">After the celebration</p>
        <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">{heading}</h2>
        <p className="mt-4 font-sans text-muted-foreground">{subtitle}</p>

        <motion.div className="mt-12" initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.2 }}>
          <Card className="overflow-hidden border-plum/30 bg-espresso shadow-xl">
            <CardContent className="relative flex aspect-video flex-col items-center justify-center gap-4">
              <div className="absolute inset-0 bg-gradient-to-br from-plum/20 via-espresso to-plum/10" />
              {highlightUrl ? (
                <video controls className="absolute inset-0 size-full object-cover" preload="metadata">
                  <source src={highlightUrl} />
                </video>
              ) : (
                <>
                  <span className="relative z-10 flex size-20 items-center justify-center rounded-full border-2 border-plum-light/40 bg-plum/20">
                    <Camera className="size-8 text-plum-light" />
                  </span>
                  <p className="relative z-10 wewed-heading text-xl text-champagne/80">{names}</p>
                  <p className="relative z-10 max-w-lg px-6 font-sans text-sm text-champagne/50">
                    Add the official highlight film here when it is ready. Guest photos and memories continue below.
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

function PlaybackSection() {
  const ctx = useWeddingContextSafe()
  const playedSongs = (ctx?.songs ?? []).filter((song) => Boolean(song.playedAt))

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
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">What We Danced To</h2>
          <p className="mt-4 font-sans text-muted-foreground">The wedding soundtrack becomes a memory of the day.</p>
        </div>

        {playedSongs.length > 0 ? (
          <div className="max-h-[500px] space-y-2 overflow-y-auto wewed-scroll pr-1">
            {playedSongs.map((song, index) => (
              <motion.div key={song.id} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04 }}>
                <Card className="border-plum/15 bg-champagne transition-all duration-300 hover:border-plum/30 hover:shadow-md">
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-plum/10"><Disc3 className="size-4 text-plum" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="wewed-heading truncate text-base text-espresso">{song.title}</p>
                      <p className="truncate font-sans text-sm text-muted-foreground">{song.artist}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="secondary" className="border-plum/20 bg-plum/10 font-sans text-xs text-plum">{song.moment || song.phase.replaceAll('_', ' ')}</Badge>
                      <span className="font-sans text-xs text-muted-foreground">Played {new Date(song.playedAt as string).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-plum/25 bg-champagne/60">
            <CardContent className="py-8 text-center">
              <Disc3 className="mx-auto size-7 text-plum/50" />
              <p className="mt-3 font-sans text-sm text-muted-foreground">Played-song history will appear here as the wedding soundtrack is recorded.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </motion.section>
  )
}

function MemoryGateway() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const names = coupleNames(wedding)
  const thankYou = ctx?.getContent(
    'after',
    'thankYou',
    `Thank you for celebrating with ${names}. Keep sharing the photographs, messages and memories that made the day yours too.`,
  ) ?? `Thank you for celebrating with ${names}. Keep sharing the photographs, messages and memories that made the day yours too.`

  return (
    <motion.section
      id="after-keepsakes"
      className="py-20 md:py-32"
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-100px' }}
    >
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-12 text-center">
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">Keep the Day Alive</h2>
          <p className="mt-4 font-sans text-muted-foreground">The social site becomes the shared memory space after the ceremony.</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Card className="border-plum/20 bg-champagne"><CardContent className="flex h-full flex-col items-center gap-4 py-8 text-center"><Images className="size-7 text-plum" /><p className="wewed-heading text-xl text-espresso">Gallery</p><p className="font-sans text-sm text-muted-foreground">Browse photographs shared for this wedding.</p><Button asChild variant="outline" className="mt-auto border-plum/30 text-plum"><a href="#gallery">Browse photos</a></Button></CardContent></Card>
          <Card className="border-plum/20 bg-champagne"><CardContent className="flex h-full flex-col items-center gap-4 py-8 text-center"><MessageSquare className="size-7 text-plum" /><p className="wewed-heading text-xl text-espresso">Messages</p><p className="font-sans text-sm text-muted-foreground">Leave a guest contribution or memory for the couple.</p><Button asChild variant="outline" className="mt-auto border-plum/30 text-plum"><a href="#contributions">Share a memory</a></Button></CardContent></Card>
          <Card className="border-plum/20 bg-champagne"><CardContent className="flex h-full flex-col items-center gap-4 py-8 text-center"><Heart className="size-7 text-plum" /><p className="wewed-heading text-xl text-espresso">Memory Capsule</p><p className="font-sans text-sm text-muted-foreground">Preserve moments that the couple can revisit long after the day.</p><Button asChild variant="outline" className="mt-auto border-plum/30 text-plum"><a href="#memory">Open memories</a></Button></CardContent></Card>
        </div>

        <div className="mt-14 text-center">
          <Separator className="mx-auto w-24 bg-plum/20" />
          <p className="mx-auto mt-8 max-w-2xl font-serif text-lg italic leading-relaxed text-espresso/70">{thankYou}</p>
          <p className="mt-5 wewed-monogram text-sm tracking-widest text-plum">{names}</p>
        </div>
      </div>
    </motion.section>
  )
}

export function AfterSections() {
  const { lifecycle } = useWewedStore()
  if (lifecycle !== 'after') return null

  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-0 right-0 top-0 h-32 bg-gradient-to-b from-plum/5 to-transparent" />
      <RecapSection />
      <div className="wewed-divider" />
      <PlaybackSection />
      <div className="wewed-divider" />
      <MemoryGateway />
    </div>
  )
}
