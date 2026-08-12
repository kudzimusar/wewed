'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { Camera, Upload, X, Check, Image as ImageIcon, Video, Loader2, Lock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import { coupleNames, formatWeddingDate } from '@/lib/wedding-template-defaults'

type Moment = 'ceremony' | 'reception' | 'candid' | 'preparation' | 'group_photo'

interface QueuedFile {
  id: string
  file: File
  previewUrl: string
  caption: string
  moment: Moment
  status: 'queued' | 'uploading' | 'done' | 'error'
  error?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
const MOMENT_OPTIONS: Array<{ value: Moment; label: string }> = [
  { value: 'ceremony', label: 'Ceremony' },
  { value: 'reception', label: 'Reception' },
  { value: 'candid', label: 'Candid' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'group_photo', label: 'Group Photo' },
]

function fileKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function MediaUpload() {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const sectionRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })
  const { toast } = useToast()
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [defaultMoment, setDefaultMoment] = useState<Moment>('candid')
  const [submitting, setSubmitting] = useState(false)
  const [sharingOpen, setSharingOpen] = useState(false)

  useEffect(() => {
    if (!wedding?.date) {
      setSharingOpen(false)
      return
    }
    const weddingTime = new Date(wedding.date).getTime()
    setSharingOpen(Number.isFinite(weddingTime) && Date.now() >= weddingTime)
  }, [wedding?.date])

  useEffect(() => {
    return () => queue.forEach((item) => URL.revokeObjectURL(item.previewUrl))
  }, [queue])

  const addFiles = useCallback((files: FileList | File[]) => {
    const next: QueuedFile[] = Array.from(files).map((file) => ({
      id: fileKey(),
      file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
      moment: defaultMoment,
      status: 'queued',
      error: !ALLOWED.has(file.type)
        ? 'Unsupported file type.'
        : file.size > MAX_FILE_SIZE
          ? 'File exceeds the 10 MB limit.'
          : undefined,
    }))
    setQueue((current) => [...current, ...next])
  }, [defaultMoment])

  const remove = (id: string) => {
    setQueue((current) => {
      const item = current.find((candidate) => candidate.id === id)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return current.filter((candidate) => candidate.id !== id)
    })
  }

  const patch = (id: string, changes: Partial<QueuedFile>) => {
    setQueue((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  }

  async function uploadOne(item: QueuedFile): Promise<boolean> {
    if (!ctx?.slug || item.error) return false
    patch(item.id, { status: 'uploading', error: undefined })
    const form = new FormData()
    form.append('slug', ctx.slug)
    form.append('file', item.file)
    form.append('caption', item.caption)
    form.append('moment', item.moment)

    try {
      const response = await fetch('/api/media', { method: 'POST', body: form })
      const body = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null
      if (!response.ok || !body?.success) throw new Error(body?.error || 'Upload failed.')
      patch(item.id, { status: 'done' })
      return true
    } catch (caught) {
      patch(item.id, { status: 'error', error: caught instanceof Error ? caught.message : 'Upload failed.' })
      return false
    }
  }

  const uploadAll = async () => {
    const pending = queue.filter((item) => item.status !== 'done' && !item.error)
    if (!pending.length) return
    setSubmitting(true)
    let completed = 0
    for (const item of pending) {
      if (await uploadOne(item)) completed += 1
    }
    setSubmitting(false)
    if (completed > 0) {
      toast({ title: completed === 1 ? 'Memory shared' : `${completed} memories shared`, description: 'Your upload is attached only to this wedding.' })
      window.setTimeout(() => {
        setQueue((current) => current.filter((item) => item.status !== 'done'))
      }, 1200)
    }
  }

  const names = coupleNames(wedding)

  return (
    <section id="share" className="wewed-section bg-ivory py-20 md:py-32">
      <div ref={sectionRef} className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }} transition={{ duration: 0.7 }} className="mb-10 text-center">
          <SectionEyebrow>Guest Camera Roll</SectionEyebrow>
          <h2 className="wewed-heading wewed-heading-accent text-4xl text-espresso md:text-5xl">Share a Memory</h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
            Add photographs or short videos for {names}. Every upload is wedding-scoped and requires a verified wedding identity.
          </p>
        </motion.div>

        {!sharingOpen ? (
          <Card className="border-gold/25 bg-champagne shadow-sm">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-gold/10"><Lock className="size-6 text-gold" /></span>
              <h3 className="wewed-heading text-2xl text-espresso">Guest uploads open on the wedding day</h3>
              <p className="max-w-lg font-sans text-sm leading-6 text-muted-foreground">
                {wedding?.date ? `Sharing opens on ${formatWeddingDate(wedding.date)}. Until then, the couple keeps this space prepared for the celebration.` : 'The couple will open guest media sharing when the wedding date is confirmed.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-gold/25 bg-champagne shadow-sm">
            <CardContent className="space-y-5 p-5 sm:p-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-sans text-sm font-medium text-espresso">Choose photos or videos</p>
                  <p className="font-sans text-xs text-muted-foreground">JPG, PNG, WEBP, GIF, MP4 or WEBM · max 10 MB each</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={defaultMoment} onValueChange={(value) => setDefaultMoment(value as Moment)}>
                    <SelectTrigger className="w-36 border-gold/25 bg-white/70"><SelectValue /></SelectTrigger>
                    <SelectContent>{MOMENT_OPTIONS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button type="button" onClick={() => inputRef.current?.click()} className="bg-gold text-espresso hover:bg-gold-light"><Upload className="size-4" />Add files</Button>
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" multiple className="sr-only" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = '' }} />
                </div>
              </div>

              {queue.length === 0 ? (
                <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-gold/35 bg-ivory/55 p-6 text-center transition hover:bg-gold/5">
                  <Camera className="size-8 text-gold/70" />
                  <span className="wewed-heading text-xl text-espresso">Add something from your camera roll</span>
                  <span className="font-sans text-xs text-muted-foreground">Your upload will be attached only to {names}.</span>
                </button>
              ) : (
                <div className="space-y-3">
                  {queue.map((item) => (
                    <div key={item.id} className="grid gap-3 rounded-xl border border-gold/20 bg-white/60 p-3 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
                      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-espresso">
                        {item.file.type.startsWith('image/') ? <img src={item.previewUrl} alt="Upload preview" className="size-full object-cover" /> : <Video className="size-6 text-champagne/70" />}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2"><span className="truncate font-sans text-sm text-espresso">{item.file.name}</span>{item.status === 'done' && <Check className="size-4 text-sage" />}{item.status === 'uploading' && <Loader2 className="size-4 animate-spin text-gold" />}</div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                          <Input value={item.caption} onChange={(event) => patch(item.id, { caption: event.target.value })} placeholder="Optional caption" className="border-gold/20 bg-white/80" />
                          <Select value={item.moment} onValueChange={(value) => patch(item.id, { moment: value as Moment })}><SelectTrigger className="border-gold/20 bg-white/80"><SelectValue /></SelectTrigger><SelectContent>{MOMENT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
                        </div>
                        {item.error && <p className="font-sans text-xs text-clay">{item.error}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(item.id)} aria-label="Remove file"><X className="size-4" /></Button>
                    </div>
                  ))}
                  <div className="flex justify-end"><Button type="button" onClick={() => void uploadAll()} disabled={submitting || queue.every((item) => Boolean(item.error) || item.status === 'done')} className="bg-espresso text-champagne">{submitting ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}Share selected</Button></div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  )
}
