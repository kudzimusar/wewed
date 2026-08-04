'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  CalendarHeart,
  Camera,
  Check,
  Copy,
  Download,
  Gift,
  Loader2,
  Mail,
  MapPin,
  Music,
  Printer,
  QrCode,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import {
  buildEmailUrl,
  buildWhatsAppUrl,
  copyToClipboard,
  useNativeShare,
} from '@/lib/social'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'

type DestinationKey =
  | 'website'
  | 'photos'
  | 'songs'
  | 'programme'
  | 'venue'
  | 'registry'

interface Destination {
  key: DestinationKey
  label: string
  description: string
  suffix: string
  icon: typeof QrCode
  shareLead: string
}

const DESTINATIONS: Destination[] = [
  {
    key: 'website',
    label: 'Wedding website',
    description: 'The public wedding experience.',
    suffix: '#home',
    icon: Sparkles,
    shareLead: 'Open the wedding website:',
  },
  {
    key: 'programme',
    label: 'Programme',
    description: 'Wedding-day order and timing.',
    suffix: '#theday',
    icon: CalendarHeart,
    shareLead: 'View the wedding programme:',
  },
  {
    key: 'venue',
    label: 'Venue & travel',
    description: 'Venue details, directions and travel.',
    suffix: '#travel',
    icon: MapPin,
    shareLead: 'View venue and travel details:',
  },
  {
    key: 'photos',
    label: 'Photos',
    description: 'Wedding gallery and guest uploads.',
    suffix: '#gallery',
    icon: Camera,
    shareLead: 'Open the wedding gallery:',
  },
  {
    key: 'songs',
    label: 'Song requests',
    description: 'Request a song for the celebration.',
    suffix: '#songbook',
    icon: Music,
    shareLead: 'Request a wedding song:',
  },
  {
    key: 'registry',
    label: 'Registry',
    description: 'Gift registry and contributions.',
    suffix: '#gifts',
    icon: Gift,
    shareLead: 'Open the wedding registry:',
  },
]

interface QrResponse {
  success: boolean
  qr?: string
}

async function fetchQr(data: string, size = 400): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/qrcode?data=${encodeURIComponent(data)}&size=${size}`,
      { cache: 'no-store' },
    )
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
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return new Blob([bytes], { type: mime })
  } catch {
    return null
  }
}

function printableText(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return value.replace(/[&<>"']/g, (character) => entities[character] || character)
}

export function QrGatewayTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onOpen}
      aria-label="Open wedding QR and sharing"
      title="Wedding QR and sharing"
      className="border-gold/30 bg-espresso/40 text-champagne backdrop-blur-sm transition-colors hover:bg-gold/10 hover:text-gold"
    >
      <QrCode className="size-4" />
    </Button>
  )
}

function FloatingQrButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Open wedding QR and sharing"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.4 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 left-4 z-40 flex size-12 items-center justify-center rounded-full border border-gold/40 bg-espresso/95 text-gold shadow-xl backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:hidden"
    >
      <QrCode className="size-5" />
    </motion.button>
  )
}

export interface QrGatewayProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function QrGateway({ open, onOpenChange }: QrGatewayProps) {
  const { wedding, slug } = useWeddingContext()
  const { toast } = useToast()
  const { canShare, share } = useNativeShare()
  const [internalOpen, setInternalOpen] = useState(false)
  const [destination, setDestination] = useState<Destination>(DESTINATIONS[0])
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const isOpen = open ?? internalOpen
  const setOpen = useCallback((next: boolean) => {
    if (onOpenChange) onOpenChange(next)
    else setInternalOpen(next)
  }, [onOpenChange])

  const names = wedding
    ? `${wedding.couple.partner1} & ${wedding.couple.partner2}`
    : 'This wedding'
  const date = wedding
    ? new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(wedding.date))
    : ''
  const venue = wedding
    ? [wedding.venue, wedding.venueCity, wedding.venueCountry].filter(Boolean).join(', ')
    : ''
  const privateWedding = wedding?.privacy !== 'public'
  const DestinationIcon = destination.icon

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/w/${encodeURIComponent(slug)}${destination.suffix}`
    return `${window.location.origin}/w/${encodeURIComponent(slug)}${destination.suffix}`
  }, [destination.suffix, slug])

  const shareMessage = useMemo(() => {
    const details = [names, date, venue].filter(Boolean).join(' · ')
    return `${destination.shareLead}\n${details}\n${shareUrl}`
  }, [date, destination.shareLead, names, shareUrl, venue])

  useEffect(() => {
    if (!isOpen || privateWedding) return
    let active = true
    setQrLoading(true)
    setQrDataUrl(null)
    void fetchQr(shareUrl).then((data) => {
      if (!active) return
      setQrDataUrl(data)
      setQrLoading(false)
    })
    return () => { active = false }
  }, [isOpen, privateWedding, shareUrl])

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timer)
  }, [copied])

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(shareUrl)
    if (success) {
      setCopied(true)
      toast({ title: 'Link copied', description: 'The current wedding destination is ready to paste.' })
    } else {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }, [shareUrl, toast])

  const handleNativeShare = useCallback(async () => {
    const result = await share({ title: `${names} | Wewed`, text: shareMessage, url: shareUrl })
    if (result === 'shared') toast({ title: 'Shared' })
    if (result === 'copied') toast({ title: 'Link copied' })
    if (result === 'failed') toast({ title: 'Share failed', variant: 'destructive' })
  }, [names, share, shareMessage, shareUrl, toast])

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) return
    const blob = dataUrlToBlob(qrDataUrl)
    if (!blob) return
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `wewed-${slug}-${destination.key}-qr.png`
    anchor.click()
    URL.revokeObjectURL(objectUrl)
  }, [destination.key, qrDataUrl, slug])

  const handlePrint = useCallback(() => {
    if (!qrDataUrl) return
    const printWindow = window.open('', '_blank', 'width=800,height=900')
    if (!printWindow) {
      toast({ title: 'Pop-up blocked', description: 'Allow pop-ups to print the QR.', variant: 'destructive' })
      return
    }
    printWindow.document.write(`<!doctype html><html><head><title>${printableText(names)} — ${printableText(destination.label)}</title><style>@page{margin:24mm}body{font-family:Georgia,serif;background:#fbf6ee;color:#1a1410;text-align:center;padding:48px}.eyebrow{color:#8d6b33;letter-spacing:.22em;text-transform:uppercase;font:12px system-ui}h1{font-weight:400;font-size:38px}.details{color:#665f58;margin-bottom:28px}.qr{display:inline-block;padding:24px;background:white;border:1px solid #bf9b5f;border-radius:16px}.qr img{display:block;width:320px;height:320px}.url{font:13px monospace;word-break:break-all;margin-top:24px}</style></head><body><p class="eyebrow">Wewed · ${printableText(destination.label)}</p><h1>${printableText(names)}</h1><p class="details">${printableText([date, venue].filter(Boolean).join(' · '))}</p><div class="qr"><img src="${qrDataUrl}" alt="QR code" /></div><p class="url">${printableText(shareUrl)}</p><script>window.onload=()=>window.print()</script></body></html>`)
    printWindow.document.close()
  }, [date, destination.label, names, qrDataUrl, shareUrl, toast, venue])

  return (
    <>
      <FloatingQrButton onClick={() => setOpen(true)} />
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94dvh] overflow-y-auto border-gold/30 bg-champagne text-espresso sm:max-w-3xl">
          <DialogTitle className="flex items-center gap-2 font-serif text-3xl">
            <QrCode className="size-6 text-gold-muted" />
            Wedding QR and sharing
          </DialogTitle>
          <DialogDescription>
            Public sharing is wedding-scoped. Private invitation credentials are only created in the guest invitation manager.
          </DialogDescription>

          {privateWedding ? (
            <div className="space-y-5 rounded-2xl border border-gold/25 bg-white/60 p-5 sm:p-7" data-testid="private-wedding-qr-guard">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-6 shrink-0 text-gold-muted" />
                <div>
                  <h3 className="font-serif text-2xl">Private wedding protected</h3>
                  <p className="mt-2 text-sm leading-6 text-espresso/65">
                    A generic QR cannot safely open this invitation on another device. Each guest must receive their own digital card, RSVP link and QR code so access stays revocable and guest-scoped.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="bg-gold text-espresso hover:bg-gold-light">
                  <a href="/couple/invitations">Open digital invitation cards</a>
                </Button>
                <Button asChild variant="outline">
                  <a href="/planner/guests">Open planner guest tools</a>
                </Button>
              </div>
              <p className="text-xs leading-5 text-espresso/55">
                Guests should use the original card or QR they received. Do not forward a private guest link.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
              <div className="flex min-h-72 items-center justify-center rounded-2xl border border-gold/25 bg-white p-5">
                {qrLoading && <Loader2 className="size-8 animate-spin text-gold-muted" />}
                {!qrLoading && qrDataUrl && <img src={qrDataUrl} alt={`${destination.label} QR code for ${names}`} className="size-64 max-w-full" />}
                {!qrLoading && !qrDataUrl && <p className="text-center text-sm text-espresso/55">QR generation is unavailable.</p>}
              </div>
              <div className="space-y-5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      <span className="flex items-center gap-2"><DestinationIcon className="size-4" />{destination.label}</span>
                      <span aria-hidden="true">▾</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-72">
                    <DropdownMenuLabel>QR destination</DropdownMenuLabel>
                    {DESTINATIONS.map((item) => (
                      <DropdownMenuItem key={item.key} onSelect={() => setDestination(item)}>
                        <item.icon className="mr-2 size-4" />
                        <span><span className="block font-medium">{item.label}</span><span className="block text-xs text-muted-foreground">{item.description}</span></span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="rounded-xl border border-gold/20 bg-white/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted">Current destination</p>
                  <p className="mt-2 break-all font-mono text-xs">{shareUrl}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Button type="button" variant="outline" onClick={() => window.open(buildWhatsAppUrl(shareMessage), '_blank', 'noopener,noreferrer')}><Share2 className="size-4" />WhatsApp</Button>
                  <Button type="button" variant="outline" onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareMessage)}`, '_blank', 'noopener,noreferrer')}><Send className="size-4" />Telegram</Button>
                  <Button type="button" variant="outline" onClick={() => window.open(buildEmailUrl(`${names} wedding`, shareMessage), '_blank', 'noopener,noreferrer')}><Mail className="size-4" />Email</Button>
                  <Button type="button" variant="outline" onClick={() => void handleCopy()}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? 'Copied' : 'Copy'}</Button>
                  <Button type="button" variant="outline" onClick={handleDownload} disabled={!qrDataUrl}><Download className="size-4" />Download</Button>
                  <Button type="button" variant="outline" onClick={handlePrint} disabled={!qrDataUrl}><Printer className="size-4" />Print</Button>
                </div>
                {canShare && <Button type="button" className="w-full bg-gold text-espresso hover:bg-gold-light" onClick={() => void handleNativeShare()}><Share2 className="size-4" />Open share sheet</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default QrGateway
