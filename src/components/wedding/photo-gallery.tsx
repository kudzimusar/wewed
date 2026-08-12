'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Camera, ZoomIn, X, Loader2, Images } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SectionInfo } from '@/components/wedding/section-info'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import { coupleNames } from '@/lib/wedding-template-defaults'

interface MediaItem {
  id: string
  type: string
  url: string
  thumbnailUrl?: string | null
  caption?: string | null
  moment?: string | null
  isCurated?: boolean
  isHero?: boolean
  uploadedAt?: string | null
}

type FilterKey = 'all' | 'ceremony' | 'reception' | 'candid' | 'preparation' | 'group_photo' | 'videos'

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'ceremony', label: 'Ceremony' },
  { key: 'reception', label: 'Reception' },
  { key: 'candid', label: 'Candid' },
  { key: 'preparation', label: 'Preparation' },
  { key: 'group_photo', label: 'Group Photos' },
  { key: 'videos', label: 'Videos' },
]

const MOMENT_LABELS: Record<string, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  candid: 'Candid',
  preparation: 'Preparation',
  group_photo: 'Group Photo',
}

const SPAN_HINTS = ['aspect-[3/4]', 'aspect-square', 'aspect-[4/5]', 'aspect-[4/3]', 'aspect-[3/4]', 'aspect-[5/4]']

export function PhotoGallery() {
  const ctx = useWeddingContextSafe()
  const sectionRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })
  const [filter, setFilter] = useState<FilterKey>('all')
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<MediaItem | null>(null)

  const fetchMedia = useCallback(async () => {
    if (!ctx?.slug) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/media?slug=${encodeURIComponent(ctx.slug)}`, { cache: 'no-store' })
      const data = (await res.json().catch(() => null)) as { success?: boolean; data?: MediaItem[]; error?: string } | null
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load gallery.')
      const list = Array.isArray(data.data) ? [...data.data] : []
      list.sort((a, b) => {
        if (Boolean(a.isHero) !== Boolean(b.isHero)) return b.isHero ? 1 : -1
        const ta = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0
        const tb = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0
        return tb - ta
      })
      setItems(list)
    } catch (caught) {
      setItems([])
      setError(caught instanceof Error ? caught.message : 'Failed to load gallery.')
    } finally {
      setLoading(false)
    }
  }, [ctx?.slug])

  useEffect(() => { void fetchMedia() }, [fetchMedia])

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    if (filter === 'videos') return items.filter((item) => item.type === 'video')
    return items.filter((item) => item.moment === filter)
  }, [items, filter])

  const title = ctx?.getContent('gallery', 'heading', 'Our Wedding Gallery') ?? 'Our Wedding Gallery'
  const subtitle = ctx?.getContent(
    'gallery',
    'subtitle',
    `Photographs and films shared for ${coupleNames(ctx?.wedding)} live only inside this wedding's social space.`,
  ) ?? `Photographs and films shared for ${coupleNames(ctx?.wedding)} live only inside this wedding's social space.`

  return (
    <section id="gallery" className="wewed-section bg-champagne py-20 md:py-32">
      <div ref={sectionRef} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7 }}
          className="mb-12 text-center"
        >
          <SectionEyebrow>Shared Memories</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">
            {title} <SectionInfo text="Only media attached to this wedding is loaded here. Guests never see another couple's gallery." />
          </h2>
          <p className="mx-auto mt-4 max-w-2xl font-sans leading-relaxed text-muted-foreground">{subtitle}</p>
        </motion.div>

        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition ${filter === item.key ? 'bg-plum text-champagne shadow-sm' : 'border border-plum/20 text-espresso hover:bg-plum/10'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold" /></div>
        ) : filtered.length > 0 ? (
          <motion.div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}>
            {filtered.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                variants={{ hidden: { opacity: 0, y: 18 }, visible: { opacity: 1, y: 0 } }}
                className="group text-left"
              >
                <Card className="relative overflow-hidden border-plum/15 bg-espresso shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className={`relative ${SPAN_HINTS[index % SPAN_HINTS.length]} overflow-hidden`}>
                    {item.type === 'video' ? (
                      <video src={item.url} muted preload="metadata" className="size-full object-cover" />
                    ) : (
                      <img src={item.thumbnailUrl || item.url} alt={item.caption || `${coupleNames(ctx?.wedding)} wedding memory`} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-espresso/75 via-transparent to-transparent" />
                    {item.moment && <Badge className="absolute left-2 top-2 border-gold/20 bg-espresso/75 text-[9px] uppercase tracking-[0.12em] text-champagne">{MOMENT_LABELS[item.moment] || item.moment}</Badge>}
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
                      <p className="line-clamp-2 font-serif text-sm italic text-champagne">{item.caption || 'A wedding memory'}</p>
                      <ZoomIn className="size-4 shrink-0 text-gold" />
                    </div>
                  </div>
                </Card>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-gold/30 bg-ivory/60 px-6 py-12 text-center">
            <Images className="mx-auto size-10 text-gold/60" />
            <h3 className="mt-4 font-serif text-2xl text-espresso">The gallery is ready for this wedding</h3>
            <p className="mt-2 font-sans text-sm leading-6 text-muted-foreground">
              No wedding media has been published yet. Guests can add photos through the upload section when sharing is open.
            </p>
            {error && <p className="mt-3 font-sans text-xs text-clay">{error}</p>}
            <Button asChild variant="outline" className="mt-5 border-gold/30"><a href="#share"><Camera className="size-4" />Share a photo</a></Button>
          </div>
        )}
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-w-5xl border-gold/20 bg-espresso p-2 text-champagne sm:p-3">
          <DialogTitle className="sr-only">Wedding media preview</DialogTitle>
          <Button type="button" size="icon" variant="ghost" onClick={() => setSelected(null)} className="absolute right-3 top-3 z-20 text-champagne hover:bg-white/10" aria-label="Close preview"><X className="size-5" /></Button>
          {selected && (
            <div className="overflow-hidden rounded-xl">
              {selected.type === 'video' ? (
                <video src={selected.url} controls autoPlay className="max-h-[80vh] w-full object-contain" />
              ) : (
                <img src={selected.url} alt={selected.caption || 'Wedding memory'} className="max-h-[80vh] w-full object-contain" />
              )}
              {selected.caption && <p className="p-4 text-center font-serif text-lg italic text-champagne/85">{selected.caption}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
