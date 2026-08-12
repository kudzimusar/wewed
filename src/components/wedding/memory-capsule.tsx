'use client'

import { motion } from 'framer-motion'
import { Heart, Images, Lock, MessageCircle, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import {
  compactWeddingDate,
  coupleNames,
  formatWeddingDate,
} from '@/lib/wedding-template-defaults'

export function MemoryCapsule() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const names = coupleNames(wedding)
  const date = formatWeddingDate(wedding?.date)
  const heading = ctx?.getContent('memory', 'heading', 'Memory Time Capsule') ?? 'Memory Time Capsule'
  const subtitle = ctx?.getContent(
    'memory',
    'subtitle',
    `Leave something meaningful for ${names} to return to after the celebration.`,
  ) ?? `Leave something meaningful for ${names} to return to after the celebration.`
  const prompt = ctx?.getContent(
    'memory',
    'prompt',
    'Share a message, photograph or favourite moment. Contributions stay attached to this wedding and are shown only according to the couple’s publication and privacy choices.',
  ) ?? 'Share a message, photograph or favourite moment. Contributions stay attached to this wedding and are shown only according to the couple’s publication and privacy choices.'
  const footerMark = [wedding?.monogram || names, compactWeddingDate(wedding?.date)].filter(Boolean).join(' · ')

  return (
    <section id="memory" className="wewed-section py-20 md:py-32">
      <div className="mx-auto max-w-4xl px-4">
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7 }}
        >
          <SectionEyebrow>For Later</SectionEyebrow>
          <div className="mb-3 flex items-center justify-center gap-2">
            <Lock className="size-4 text-plum" />
            <span className="font-sans text-xs uppercase tracking-[0.22em] text-plum">
              {date ? `A keepsake for ${date}` : 'A keepsake for the couple'}
            </span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">{heading}</h2>
          <p className="mx-auto mt-4 max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground md:text-base">{subtitle}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Card className="relative overflow-hidden border border-plum/30 bg-champagne shadow-md">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-plum/[0.04] via-transparent to-gold/[0.06]" />
            <CardContent className="relative p-6 sm:p-8 md:p-10">
              <div className="mx-auto max-w-2xl text-center">
                <span className="mx-auto flex size-16 items-center justify-center rounded-full border border-plum/25 bg-plum/10">
                  <Heart className="size-7 text-plum" />
                </span>
                <p className="mt-6 font-serif text-lg italic leading-8 text-espresso/75">{prompt}</p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <Button asChild className="bg-plum text-champagne hover:bg-plum-light">
                    <a href="#village"><MessageCircle className="size-4" />Share a message</a>
                  </Button>
                  <Button asChild variant="outline" className="border-gold/35 bg-white/40 text-espresso hover:bg-gold/10">
                    <a href="#share"><Images className="size-4" />Share a photo</a>
                  </Button>
                </div>
              </div>

              <div className="mt-10 grid gap-3 border-t border-plum/15 pt-7 sm:grid-cols-3">
                <div className="rounded-xl border border-gold/15 bg-white/45 p-4 text-center">
                  <MessageCircle className="mx-auto size-4 text-gold" />
                  <p className="mt-2 font-sans text-xs font-medium text-espresso">Messages</p>
                  <p className="mt-1 font-sans text-[11px] leading-4 text-muted-foreground">Guest notes can be reviewed and preserved with this wedding.</p>
                </div>
                <div className="rounded-xl border border-gold/15 bg-white/45 p-4 text-center">
                  <Images className="mx-auto size-4 text-gold" />
                  <p className="mt-2 font-sans text-xs font-medium text-espresso">Media</p>
                  <p className="mt-1 font-sans text-[11px] leading-4 text-muted-foreground">Wedding photos and films remain scoped to the active couple.</p>
                </div>
                <div className="rounded-xl border border-gold/15 bg-white/45 p-4 text-center">
                  <Sparkles className="mx-auto size-4 text-gold" />
                  <p className="mt-2 font-sans text-xs font-medium text-espresso">After the day</p>
                  <p className="mt-1 font-sans text-[11px] leading-4 text-muted-foreground">The same social space becomes a shared archive after the ceremony.</p>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <Badge variant="outline" className="border-plum/30 bg-plum/5 font-sans text-[10px] text-plum">
                  <Lock className="mr-1 size-2.5" />Wedding-scoped memories
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div className="mt-10 text-center" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="wewed-divider mx-auto w-32" />
          {footerMark && <p className="mt-6 wewed-monogram text-xs tracking-widest">{footerMark}</p>}
        </motion.div>
      </div>
    </section>
  )
}
