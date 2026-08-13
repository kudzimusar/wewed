'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  Camera,
  Upload,
  X,
  Check,
  Image as ImageIcon,
  Video,
  Sparkles,
  AlertCircle,
  Lock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { SectionEyebrow } from '@/components/wedding/section-eyebrow'
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider'
import {
  compactWeddingDate,
  coupleNames,
  formatWeddingDate,
} from '@/lib/wedding-template-defaults'

type Moment = 'ceremony' | 'reception' | 'candid' | 'preparation' | 'group_photo'

interface QueuedFile {
  id: string
  file: File
  previewUrl: string
  caption: string
  moment: Moment
  error?: string
  status: 'queued' | 'uploading' | 'done' | 'error'
  progress: number
}

interface UploadResponse {
  success?: boolean
  error?: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_VIDEO = new Set(['video/mp4', 'video/webm'])
const MOMENT_OPTIONS: Array<{ value: Moment; label: string }> = [
  { value: 'ceremony', label: 'Ceremony' },
  { value: 'reception', label: 'Reception' },
  { value: 'candid', label: 'Candid' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'group_photo', label: 'Group Photo' },
]
const EASING = [0.22, 1, 0.36, 1] as const

function fileKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File): string | undefined {
  if (!ALLOWED_IMAGE.has(file.type) && !ALLOWED_VIDEO.has(file.type)) {
    return 'Unsupported file type.'
  }
  if (file.size > MAX_FILE_SIZE) return 'File exceeds 10 MB limit.'
  return undefined
}

export function MediaUpload({ canUpload = false }: { canUpload?: boolean }) {
  const ctx = useWeddingContextSafe()
  const wedding = ctx?.wedding
  const names = coupleNames(wedding)
  const sectionRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<QueuedFile[]>([])
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })
  const { toast } = useToast()

  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [defaultMoment, setDefaultMoment] = useState<Moment>('candid')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [sharingOpen, setSharingOpen] = useState(false)

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  useEffect(() => {
    return () => {
      for (const item of queueRef.current) URL.revokeObjectURL(item.previewUrl)
    }
  }, [])

  useEffect(() => {
    if (!wedding?.date) {
      setSharingOpen(false)
      return
    }
    const weddingTime = new Date(wedding.date).getTime()
    setSharingOpen(Number.isFinite(weddingTime) && Date.now() >= weddingTime)
  }, [wedding?.date])

  const interactionEnabled = canUpload && sharingOpen

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      if (!interactionEnabled) return
      const next: QueuedFile[] = Array.from(files).map((file) => {
        const error = validateFile(file)
        return {
          id: fileKey(),
          file,
          previewUrl: URL.createObjectURL(file),
          caption: '',
          moment: defaultMoment,
          error,
          status: error ? 'error' : 'queued',
          progress: 0,
        }
      })
      setQueue((current) => [...current, ...next])
      setSubmitted(false)
    },
    [defaultMoment, interactionEnabled],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragActive(false)
      if (!interactionEnabled) return
      if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files)
    },
    [addFiles, interactionEnabled],
  )

  const updateFile = (id: string, patch: Partial<QueuedFile>) => {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const removeFile = (id: string) => {
    setQueue((current) => {
      const target = current.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((item) => item.id !== id)
    })
  }

  const uploadOne = async (item: QueuedFile): Promise<boolean> => {
    if (!ctx?.slug || !interactionEnabled) return false
    updateFile(item.id, { status: 'uploading', progress: 5, error: undefined })

    const form = new FormData()
    form.append('slug', ctx.slug)
    form.append('file', item.file)
    form.append('caption', item.caption)
    form.append('moment', item.moment)

    let ticker: ReturnType<typeof setInterval> | null = null
    try {
      ticker = setInterval(() => {
        setQueue((current) =>
          current.map((queued) =>
            queued.id === item.id && queued.status === 'uploading'
              ? { ...queued, progress: Math.min(90, queued.progress + 8) }
              : queued,
          ),
        )
      }, 250)

      const response = await fetch('/api/media', { method: 'POST', body: form })
      const body = (await response.json().catch(() => null)) as UploadResponse | null
      if (!response.ok || !body?.success) {
        throw new Error(body?.error || `Upload failed (${response.status}).`)
      }

      updateFile(item.id, { status: 'done', progress: 100 })
      return true
    } catch (caught) {
      updateFile(item.id, {
        status: 'error',
        progress: 0,
        error: caught instanceof Error ? caught.message : 'Upload failed.',
      })
      return false
    } finally {
      if (ticker) clearInterval(ticker)
    }
  }

  const handleUploadAll = async () => {
    if (!interactionEnabled) return
    const pending = queue.filter((item) => item.status === 'queued' || item.status === 'error')
    if (!pending.length) return

    setSubmitting(true)
    let completed = 0
    for (const item of pending) {
      const error = validateFile(item.file)
      if (error) {
        updateFile(item.id, { status: 'error', error })
        continue
      }
      if (await uploadOne(item)) completed += 1
    }
    setSubmitting(false)

    if (completed === 0) {
      toast({
        title: 'Upload failed',
        description: 'Please check your files and try again.',
        variant: 'destructive',
      })
      return
    }

    setSubmitted(true)
    toast({
      title: completed === 1 ? 'Memory shared!' : `${completed} memories shared!`,
      description: `Your upload is attached only to ${names}' wedding.`,
    })

    window.setTimeout(() => {
      setQueue((current) => {
        for (const item of current) {
          if (item.status === 'done') URL.revokeObjectURL(item.previewUrl)
        }
        return current.filter((item) => item.status !== 'done')
      })
    }, 1500)
  }

  const readyCount = queue.filter((item) => item.status === 'queued' || item.status === 'error').length
  const allValid = queue.length > 0 && queue.every((item) => !item.error)
  const footerMark = [wedding?.monogram || names, compactWeddingDate(wedding?.date)]
    .filter(Boolean)
    .join(' · ')

  const lockMessage = !canUpload
    ? 'This classic guest camera is visible to everyone, but uploads are reserved for invited or authorised wedding contributors.'
    : wedding?.date
      ? `Photo sharing opens on ${formatWeddingDate(wedding.date)}.`
      : 'Photo sharing opens when the wedding date is confirmed.'

  return (
    <section id="share" data-classic-section="media-upload" className="wewed-section bg-ivory py-20 md:py-32">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: EASING }}
          className="mb-10 text-center md:mb-14"
        >
          <SectionEyebrow>Your Moments</SectionEyebrow>
          <div className="mb-4 flex items-center justify-center">
            <Camera className="h-5 w-5 text-gold" strokeWidth={1.25} />
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
            Share Your Moments
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-sans text-sm leading-relaxed text-espresso/60 sm:text-base">
            Did you capture a beautiful moment? Share it with {names} and fellow guests.
          </p>
        </motion.div>

        {!interactionEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: EASING, delay: 0.1 }}
            data-testid="media-upload-locked-notice"
            className="mb-6 flex items-center justify-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-2 text-center"
          >
            {canUpload ? (
              <Sparkles className="size-3.5 shrink-0 text-gold" strokeWidth={1.5} />
            ) : (
              <Lock className="size-3.5 shrink-0 text-gold" strokeWidth={1.5} />
            )}
            <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-gold-muted">
              {lockMessage}
            </span>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7, ease: EASING, delay: 0.15 }}
        >
          <Card className="overflow-hidden border border-gold/30 bg-champagne shadow-sm">
            <CardContent className="p-5 sm:p-8">
              <AnimatePresence mode="wait">
                {submitted ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: EASING }}
                    className="flex flex-col items-center py-8 text-center"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 240, damping: 18, delay: 0.05 }}
                      className="flex size-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10"
                    >
                      <Check className="size-7 text-gold" strokeWidth={2} />
                    </motion.span>
                    <h3 className="mt-5 wewed-heading text-2xl font-light text-espresso sm:text-3xl">
                      Thank you for sharing!
                    </h3>
                    <p className="mt-3 max-w-md font-sans text-sm text-espresso/65">
                      Your moments are attached to {names}&apos; wedding.
                    </p>
                    <Button
                      onClick={() => setSubmitted(false)}
                      variant="outline"
                      className="mt-7 border-gold/40 bg-transparent font-sans text-xs uppercase tracking-[0.15em] text-espresso hover:bg-gold hover:text-espresso"
                    >
                      <Camera className="mr-2 size-3.5" />
                      Share more photos
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div key="uploader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div
                      onDragOver={(event) => {
                        event.preventDefault()
                        if (interactionEnabled) setDragActive(true)
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      onClick={() => {
                        if (interactionEnabled) fileInputRef.current?.click()
                      }}
                      role="button"
                      tabIndex={interactionEnabled ? 0 : -1}
                      aria-disabled={!interactionEnabled}
                      data-testid="classic-media-dropzone"
                      onKeyDown={(event) => {
                        if (!interactionEnabled) return
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          fileInputRef.current?.click()
                        }
                      }}
                      className={`group relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300 sm:py-14 ${
                        interactionEnabled ? 'cursor-pointer' : 'cursor-not-allowed'
                      } ${dragActive ? 'border-gold bg-gold/10' : 'border-gold/40 bg-white/50 hover:border-gold hover:bg-gold/5'}`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                        multiple
                        disabled={!interactionEnabled}
                        onChange={(event) => {
                          if (event.target.files?.length) addFiles(event.target.files)
                          event.target.value = ''
                        }}
                        className="sr-only"
                      />
                      <motion.span
                        whileHover={interactionEnabled ? { scale: 1.05 } : undefined}
                        className="flex size-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10 transition-colors duration-300 group-hover:bg-gold/15 sm:size-16"
                      >
                        {interactionEnabled ? (
                          <Camera className="size-6 text-gold sm:size-7" strokeWidth={1.25} />
                        ) : (
                          <Lock className="size-6 text-gold sm:size-7" strokeWidth={1.25} />
                        )}
                      </motion.span>
                      <h3 className="mt-5 wewed-heading text-xl font-light text-espresso sm:text-2xl">
                        {interactionEnabled ? 'Drop your memories here' : 'The guest camera is ready'}
                      </h3>
                      <p className="mt-2 max-w-md font-sans text-sm leading-6 text-espresso/55">
                        {interactionEnabled
                          ? 'Drag photos or short videos here, or tap to choose files from your device.'
                          : 'The full upload experience stays visible while access and timing remain protected.'}
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <Badge variant="outline" className="border-gold/25 bg-champagne/70 text-espresso/60">
                          <ImageIcon className="mr-1 size-3" /> JPG · PNG · WebP · GIF
                        </Badge>
                        <Badge variant="outline" className="border-gold/25 bg-champagne/70 text-espresso/60">
                          <Video className="mr-1 size-3" /> MP4 · WebM
                        </Badge>
                        <Badge variant="outline" className="border-gold/25 bg-champagne/70 text-espresso/60">
                          Max 10 MB
                        </Badge>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-3 rounded-xl border border-gold/15 bg-white/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-gold-muted">Default moment</p>
                        <p className="mt-1 font-sans text-xs text-espresso/50">You can change this for each queued file.</p>
                      </div>
                      <Select
                        value={defaultMoment}
                        onValueChange={(value) => setDefaultMoment(value as Moment)}
                        disabled={!interactionEnabled}
                      >
                        <SelectTrigger className="w-full border-gold/25 bg-champagne sm:w-44" aria-label="Default photo moment">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOMENT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {queue.length > 0 && (
                      <div className="mt-6 space-y-3" data-testid="media-upload-queue">
                        {queue.map((item) => (
                          <div key={item.id} className="overflow-hidden rounded-xl border border-gold/20 bg-white/65">
                            <div className="flex gap-3 p-3 sm:p-4">
                              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-gold/15 bg-espresso/5">
                                {item.file.type.startsWith('image/') ? (
                                  <img src={item.previewUrl} alt="Selected upload preview" className="size-full object-cover" />
                                ) : (
                                  <video src={item.previewUrl} muted className="size-full object-cover" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate font-sans text-sm font-medium text-espresso">{item.file.name}</p>
                                    <p className="font-sans text-[11px] text-espresso/45">{formatBytes(item.file.size)}</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeFile(item.id)}
                                    disabled={item.status === 'uploading'}
                                    aria-label={`Remove ${item.file.name}`}
                                    className="size-8 shrink-0 text-espresso/45 hover:text-clay"
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_150px]">
                                  <Input
                                    value={item.caption}
                                    onChange={(event) => updateFile(item.id, { caption: event.target.value })}
                                    placeholder="Add a caption…"
                                    disabled={item.status === 'uploading'}
                                    className="border-gold/20 bg-champagne/70"
                                  />
                                  <Select
                                    value={item.moment}
                                    onValueChange={(value) => updateFile(item.id, { moment: value as Moment })}
                                    disabled={item.status === 'uploading'}
                                  >
                                    <SelectTrigger className="border-gold/20 bg-champagne/70"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {MOMENT_OPTIONS.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {item.status === 'uploading' && <Progress value={item.progress} className="mt-3 h-1.5" />}
                                {item.error && (
                                  <p className="mt-2 flex items-center gap-1.5 font-sans text-xs text-clay">
                                    <AlertCircle className="size-3.5" /> {item.error}
                                  </p>
                                )}
                                {item.status === 'done' && (
                                  <p className="mt-2 flex items-center gap-1.5 font-sans text-xs text-sage">
                                    <Check className="size-3.5" /> Added to this wedding
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="font-sans text-[11px] leading-5 text-espresso/45">
                        Files are attached to this wedding only and remain subject to the wedding&apos;s contribution permissions.
                      </p>
                      <Button
                        type="button"
                        onClick={() => void handleUploadAll()}
                        disabled={!interactionEnabled || submitting || !allValid || readyCount === 0}
                        className="shrink-0 bg-gold font-sans text-xs uppercase tracking-[0.14em] text-espresso hover:bg-gold-light"
                      >
                        <Upload className="size-4" />
                        {submitting ? 'Uploading…' : readyCount > 0 ? `Upload ${readyCount}` : 'Upload memories'}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider mx-auto w-32" />
          {footerMark && <p className="mt-6 wewed-monogram text-xs tracking-widest">{footerMark}</p>}
        </motion.div>
      </div>
    </section>
  )
}
