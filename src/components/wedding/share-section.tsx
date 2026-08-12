'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Download, QrCode, Share2, ShieldCheck, Sparkles } from 'lucide-react'
import { GoldOrnament } from '@/components/wedding/decorative-elements'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { SectionInfo } from '@/components/wedding/section-info'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import { buildWhatsAppUrl, useNativeShare } from '@/lib/social'

interface QrResponse {
  success: boolean
  qr?: string
}

async function fetchQr(data: string, size = 360): Promise<string | null> {
  try {
    const response = await fetch(`/api/qrcode?data=${encodeURIComponent(data)}&size=${size}`, { cache: 'no-store' })
    if (!response.ok) return null
    const payload = (await response.json()) as QrResponse
    return payload.success ? payload.qr ?? null : null
  } catch {
    return null
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [metadata, base64] = dataUrl.split(',')
    const mime = /data:(.*?);base64/.exec(metadata)?.[1] || 'image/png'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

export function ShareSection() {
  const { wedding, slug } = useWeddingContext()
  const { toast } = useToast()
  const { canShare, share } = useNativeShare()
  const privateWedding = wedding?.privacy !== 'public'
  const [origin, setOrigin] = useState('')
  const names = wedding ? `${wedding.couple.partner1} & ${wedding.couple.partner2}` : 'This wedding'
  const date = wedding
    ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(wedding.date))
    : ''
  const venue = wedding ? [wedding.venue, wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ') : ''

  useEffect(() => setOrigin(window.location.origin), [])

  const shareUrl = useMemo(() => `${origin}/w/${encodeURIComponent(slug)}`, [origin, slug])
  const defaultMessage = useMemo(
    () => [`Celebrate with ${names}.`, date, venue, shareUrl].filter(Boolean).join('\n'),
    [date, names, shareUrl, venue],
  )
  const [message, setMessage] = useState(defaultMessage)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)

  useEffect(() => setMessage(defaultMessage), [defaultMessage])

  useEffect(() => {
    if (privateWedding || !origin) return
    let active = true
    setQrLoading(true)
    void fetchQr(shareUrl).then((data) => {
      if (!active) return
      setQrDataUrl(data)
      setQrLoading(false)
    })
    return () => { active = false }
  }, [origin, privateWedding, shareUrl])

  const handleNativeShare = useCallback(async () => {
    const result = await share({ title: `${names} | Wewed`, text: message, url: shareUrl })
    if (result === 'shared') toast({ title: 'Shared' })
    if (result === 'copied') toast({ title: 'Link copied' })
    if (result === 'failed') toast({ title: 'Share failed', variant: 'destructive' })
  }, [message, names, share, shareUrl, toast])

  const handleDownloadQr = useCallback(() => {
    if (!qrDataUrl) return
    const blob = dataUrlToBlob(qrDataUrl)
    if (!blob) return
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `wewed-${slug}-qr.png`
    anchor.click()
    URL.revokeObjectURL(objectUrl)
  }, [qrDataUrl, slug])

  return (
    <section id="share-wedding" className="wewed-section relative bg-ivory py-20 sm:py-28" aria-labelledby="share-wedding-heading">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(191,155,95,0.10), transparent 60%)' }} />
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} className="text-center">
          <p className="wewed-monogram mb-3 font-sans text-xs uppercase tracking-[0.32em]">Wedding sharing</p>
          <h2 id="share-wedding-heading" className="wewed-heading text-4xl text-espresso sm:text-5xl lg:text-6xl">
            {privateWedding ? 'Your Invitation Is Private' : 'Spread the Love'}
            <SectionInfo text={privateWedding ? 'Private wedding access is guest-specific. Never forward a personal invitation or QR.' : 'This wedding is public, so its public site link and QR may be shared.'} />
          </h2>
          <GoldOrnament className="mx-auto mt-6 w-full max-w-[16rem]" height={20} />
        </motion.div>

        {privateWedding ? (
          <Card className="mx-auto mt-12 max-w-3xl rounded-3xl border-gold/30 bg-white/80 p-7 text-center shadow-lg sm:p-10" data-testid="private-share-guard">
            <ShieldCheck className="mx-auto size-12 text-gold-muted" />
            <h3 className="mt-5 font-serif text-3xl text-espresso">Keep your personal invitation private</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-espresso/65">
              Personal wedding links and QR codes can be tied to one invited guest and their RSVP. Please do not forward them. If another person needs access, ask the couple or planner to invite them separately.
            </p>
          </Card>
        ) : (
          <Card className="mt-12 overflow-hidden rounded-3xl border-gold/40 bg-white/80 p-0 shadow-[0_20px_60px_-30px_rgba(191,155,95,0.45)] backdrop-blur">
            <div className="grid lg:grid-cols-[1.1fr_1fr]">
              <div className="border-b border-gold/20 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <p className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gold-muted"><Sparkles className="size-3.5" />Share message</p>
                <Textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-40 bg-champagne/70" aria-label="Wedding share message" />
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button type="button" onClick={() => window.open(buildWhatsAppUrl(message), '_blank', 'noopener,noreferrer')} className="bg-[#237a57] text-white hover:bg-[#1d684a]"><Share2 className="size-4" />WhatsApp</Button>
                  {canShare && <Button type="button" variant="outline" onClick={() => void handleNativeShare()}><Share2 className="size-4" />Share sheet</Button>}
                </div>
              </div>
              <div className="flex flex-col items-center justify-center p-6 text-center sm:p-8">
                <p className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-gold-muted"><QrCode className="size-3.5" />Public wedding QR</p>
                <div className="flex size-64 items-center justify-center rounded-2xl border border-gold/25 bg-white p-4">
                  {qrLoading && <span className="text-sm text-espresso/50">Generating QR…</span>}
                  {!qrLoading && qrDataUrl && <img src={qrDataUrl} alt={`Public wedding QR for ${names}`} className="size-full" />}
                  {!qrLoading && !qrDataUrl && <span className="text-sm text-espresso/50">QR unavailable</span>}
                </div>
                <Button type="button" variant="outline" className="mt-5" onClick={handleDownloadQr} disabled={!qrDataUrl}><Download className="size-4" />Download QR</Button>
                <p className="mt-4 break-all font-mono text-xs text-espresso/50">{shareUrl}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </section>
  )
}
