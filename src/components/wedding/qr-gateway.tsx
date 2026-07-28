'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode,
  Share2,
  Copy,
  Check,
  Download,
  Printer,
  Mail,
  MessageCircle,
  Send,
  X,
  ChevronDown,
  ExternalLink,
  CalendarHeart,
  Camera,
  Music,
  MapPin,
  Gift,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  WEDED_SHARE_URL,
  buildWhatsAppUrl,
  buildTelegramUrl,
  buildEmailUrl,
  useNativeShare,
  copyToClipboard,
} from '@/lib/social';

/* ============================================================
   QrGateway — global sticky QR button + sharing modal
   ------------------------------------------------------------
   Architecture:
   • <QrGatewayTrigger onOpen={...} />  — compact icon button
     styled to match the navbar's other toggles (theme /
     language / before-after). Place it inside the right-side
     cluster of the navbar (desktop). Visible sm+ only.
   • <QrGateway open onOpenChange /> — the modal + mobile
     floating button. Owns its own state when used uncontrolled
     (via the hook below) but can be controlled from the parent.

   Mobile FAB lives bottom-LEFT so it never collides with the
   WhatsApp FAB (bottom-right).

   Modal features:
   • Large QR (400px) from /api/qrcode?data=<url>&size=400
   • Wedding URL with Copy button
   • Destination dropdown (7 destinations) — each swaps the QR
   • Share buttons: WhatsApp, Telegram, Email, Native Share
   • Download PNG + Print (formatted keepsake page)

   Uses /src/lib/social.ts for share URL builders + clipboard.
   ============================================================ */

// ─── QR destinations ─────────────────────────────────────────
type DestinationKey =
  | 'website'
  | 'rsvp'
  | 'photos'
  | 'songs'
  | 'programme'
  | 'venue'
  | 'registry';

interface Destination {
  key: DestinationKey;
  label: string;
  description: string;
  // Append to the canonical share URL. Hash fragments are used
  // for in-page sections so the SPA scrolls automatically.
  suffix: string;
  icon: typeof QrCode;
  shareText: string;
}

const DESTINATIONS: Destination[] = [
  {
    key: 'website',
    label: 'Main Website',
    description: 'The full invitation — story, date, venue, RSVP.',
    suffix: '#home',
    icon: Sparkles,
    shareText:
      "You're invited to Charity & Kudzie's wedding! 🎉 Dec 23, 2026 · Imba Manor, Harare. Open the invitation: ",
  },
  {
    key: 'rsvp',
    label: 'RSVP',
    description: 'Direct link to the RSVP form.',
    suffix: '#rsvp',
    icon: CalendarHeart,
    shareText:
      "RSVP for Charity & Kudzie's wedding — Dec 23, 2026, Imba Manor. Tell us you're coming: ",
  },
  {
    key: 'photos',
    label: 'Photo Upload',
    description: 'Guest photo & video uploads.',
    suffix: '#gallery',
    icon: Camera,
    shareText:
      "Share your photos from Charity & Kudzie's wedding! Upload them here: ",
  },
  {
    key: 'songs',
    label: 'Song Requests',
    description: 'Request a song for the reception.',
    suffix: '#songbook',
    icon: Music,
    shareText:
      "What song MUST play at Charity & Kudzie's wedding? Request it here: ",
  },
  {
    key: 'programme',
    label: 'Programme',
    description: 'The order of service for the day.',
    suffix: '#theday',
    icon: CalendarHeart,
    shareText:
      "Here's the programme for Charity & Kudzie's wedding day — Dec 23, 2026: ",
  },
  {
    key: 'venue',
    label: 'Venue Directions',
    description: 'Map & directions to Imba Manor.',
    suffix: '#travel',
    icon: MapPin,
    shareText:
      "Directions to Imba Manor for Charity & Kudzie's wedding — Dec 23, 2026: ",
  },
  {
    key: 'registry',
    label: 'Registry',
    description: 'Gift registry & contributions.',
    suffix: '#gifts',
    icon: Gift,
    shareText:
      "Looking to gift Charity & Kudzie? Here's their wedding registry: ",
  },
];

// ─── QR fetch helper ─────────────────────────────────────────
interface QrResponse {
  success: boolean;
  qr?: string;
  meta?: { data: string; size: number };
  error?: string;
}

async function fetchQr(data: string, size = 400): Promise<string | null> {
  try {
    const url = `/api/qrcode?data=${encodeURIComponent(data)}&size=${size}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: QrResponse = await res.json();
    return json.success ? json.qr ?? null : null;
  } catch {
    return null;
  }
}

/** Convert a base64 data URL to a Blob for downloading. */
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [meta, b64] = dataUrl.split(',');
    const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'image/png';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}

// ─── Trigger (compact icon button, for the navbar) ───────────
export function QrGatewayTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onOpen}
      aria-label="Open wedding QR & share"
      title="QR code & sharing"
      className="border-gold/30 bg-espresso/40 text-champagne backdrop-blur-sm transition-colors hover:bg-gold/10 hover:text-gold"
    >
      <QrCode className="h-4 w-4" />
    </Button>
  );
}

// ─── Mobile floating button (bottom-left, never overlaps WhatsApp FAB) ──
function FloatingQrButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label="Open wedding QR & share"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.4 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 bg-espresso/95 text-gold shadow-xl backdrop-blur-md transition-colors hover:bg-espresso hover:text-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-champagne sm:hidden"
    >
      <QrCode className="h-5 w-5" />
      <span className="sr-only">Open QR &amp; share</span>
    </motion.button>
  );
}

// ─── Main QrGateway component ────────────────────────────────
export interface QrGatewayProps {
  /** Controlled open state. Defaults to internal state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function QrGateway({ open, onOpenChange }: QrGatewayProps) {
  const { toast } = useToast();
  const { canShare, share } = useNativeShare();

  // ── Controlled / uncontrolled state ──
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      if (onOpenChange) onOpenChange(next);
      else setInternalOpen(next);
    },
    [onOpenChange]
  );

  const [destination, setDestination] = useState<Destination>(DESTINATIONS[0]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Compose the URL + share text for the active destination.
  const shareUrl = useMemo(
    () => `${WEDED_SHARE_URL}${destination.suffix}`,
    [destination]
  );

  const shareMessage = useMemo(
    () => `${destination.shareText}${shareUrl}`,
    [destination, shareUrl]
  );

  // Fetch QR whenever the modal opens OR the destination changes.
  // We defer the synchronous setState calls (setQrLoading /
  // setQrDataUrl) to a microtask so they don't trigger a cascading
  // render from inside the effect body (React 19 rule).
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setQrLoading(true);
      setQrDataUrl(null);
      fetchQr(shareUrl, 400)
        .then((d) => {
          if (!active) return;
          setQrDataUrl(d);
          setQrLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setQrLoading(false);
        });
    });
    return () => {
      active = false;
    };
  }, [isOpen, shareUrl]);

  // Reset copied state after a delay
  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  // ── Actions ───────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      toast({ title: 'Link copied!', description: 'Paste it anywhere to invite someone.' });
    } else {
      toast({ title: 'Copy failed', description: 'Long-press the link to copy manually.', variant: 'destructive' });
    }
  }, [shareUrl, toast]);

  const handleWhatsApp = useCallback(() => {
    const url = buildWhatsAppUrl(shareMessage);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [shareMessage]);

  const handleTelegram = useCallback(() => {
    const url = buildTelegramUrl(shareMessage);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [shareMessage]);

  const handleEmail = useCallback(() => {
    const subject = "You're invited! Charity & Kudzie · 23 Dec 2026";
    const body = `${shareMessage}\n\nWith love,\nCharity & Kudzie (Mr & Mrs Musarurwa)`;
    const url = buildEmailUrl(subject, body);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [shareMessage]);

  const handleNativeShare = useCallback(async () => {
    const result = await share({
      title: "Charity & Kudzie's Wedding",
      text: shareMessage,
      url: shareUrl,
    });
    if (result === 'shared') {
      toast({ title: 'Shared!', description: 'Thanks for spreading the love.' });
    } else if (result === 'copied') {
      toast({ title: 'Link copied!', description: 'Paste it anywhere to invite someone.' });
    } else if (result === 'failed') {
      toast({ title: 'Share failed', variant: 'destructive' });
    }
  }, [share, shareMessage, shareUrl, toast]);

  const handleDownload = useCallback(() => {
    if (!qrDataUrl) {
      toast({
        title: 'QR not ready',
        description: 'Still generating — try again in a moment.',
        variant: 'destructive',
      });
      return;
    }
    const blob = dataUrlToBlob(qrDataUrl);
    if (!blob) {
      toast({ title: 'Download failed', variant: 'destructive' });
      return;
    }
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = `wewed-qr-${destination.key}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    toast({ title: 'QR downloaded', description: 'Print it. Frame it. Mail it.' });
  }, [qrDataUrl, destination.key, toast]);

  const handlePrint = useCallback(() => {
    if (!qrDataUrl) {
      toast({
        title: 'QR not ready',
        description: 'Still generating — try again in a moment.',
        variant: 'destructive',
      });
      return;
    }
    if (typeof window === 'undefined') return;
    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) {
      toast({ title: 'Pop-up blocked', description: 'Allow pop-ups to print.', variant: 'destructive' });
      return;
    }
    const html = `<!doctype html><html><head><title>Wedding QR — ${destination.label}</title>
      <style>
        @page { margin: 24mm; }
        body { font-family: Georgia, 'Cormorant Garamond', serif; padding: 60px 40px; color: #1A1410; background: #FBF6EE; text-align: center; }
        .monogram { letter-spacing: 0.32em; color: #BF9B5F; font-size: 12px; text-transform: uppercase; }
        h1 { font-weight: 400; letter-spacing: 0.04em; margin: 12px 0 4px; font-size: 36px; }
        .sub { color: #6B6560; font-size: 14px; margin-bottom: 32px; }
        .qr-wrap { display: inline-block; padding: 24px; border: 1px solid #BF9B5F; background: #FFFFFF; border-radius: 8px; }
        .qr-wrap img { width: 320px; height: 320px; display: block; }
        .label { font-family: Inter, system-ui, sans-serif; letter-spacing: 0.18em; color: #BF9B5F; font-size: 11px; text-transform: uppercase; margin-top: 24px; }
        .url { font-family: 'Courier New', monospace; color: #1A1410; font-size: 14px; margin-top: 8px; word-break: break-all; }
        .footer { margin-top: 48px; color: #BF9B5F; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; }
      </style></head><body>
      <p class="monogram">C&amp;K · 23.12.26 · Imba Manor</p>
      <h1>Charity &amp; Kudzie</h1>
      <p class="sub">Mr &amp; Mrs Musarurwa · December 23, 2026 · Harare, Zimbabwe</p>
      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="Wedding QR code — ${destination.label}" />
      </div>
      <p class="label">${destination.label}</p>
      <p class="url">${shareUrl}</p>
      <p class="footer">Scan with your phone camera · Forever · wewed</p>
      </body></html>`;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }, [qrDataUrl, destination, shareUrl, toast]);

  const onSelectDestination = useCallback((d: Destination) => {
    setDestination(d);
    setCopied(false);
  }, []);

  return (
    <>
      {/* Floating mobile button — bottom-left, never overlaps the
          WhatsApp FAB (bottom-right). */}
      <FloatingQrButton onClick={() => setOpen(true)} />

      {/* Sharing modal */}
      <Dialog open={isOpen} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="max-h-[92vh] w-[96vw] max-w-2xl gap-0 overflow-y-auto rounded-2xl border-gold/40 bg-champagne p-0 text-espresso shadow-2xl wewed-scroll"
        >
          <DialogTitle className="sr-only">
            Wedding QR code &amp; sharing
          </DialogTitle>
          <DialogDescription className="sr-only">
            Generate a QR code, copy the wedding link, or share to WhatsApp,
            Telegram, email, or your native share sheet.
          </DialogDescription>

          {/* ── Header ── */}
          <div className="relative overflow-hidden rounded-t-2xl border-b border-gold/25 bg-gradient-to-br from-espresso via-espresso to-plum/40 px-5 py-6 text-champagne sm:px-7">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full border border-gold/20 text-champagne/70 transition-colors hover:bg-gold/10 hover:text-gold"
            >
              <X className="size-4" />
            </button>
            <p className="wewed-monogram text-[10px] tracking-[0.32em] text-gold-light">
              C&amp;K · 23.12.26
            </p>
            <h2 className="wewed-heading mt-1 text-2xl sm:text-3xl">
              Share the love
            </h2>
            <p className="mt-1 font-sans text-xs text-champagne/70 sm:text-sm">
              Scan the QR or send the link — every invite plants a memory.
            </p>
          </div>

          {/* ── Body ── */}
          <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_1.1fr]">
            {/* LEFT: QR */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex size-64 items-center justify-center rounded-xl border border-gold/30 bg-white p-3 shadow-[0_8px_28px_-12px_rgba(191,155,95,0.4)] sm:size-72">
                {qrLoading ? (
                  <div className="flex h-full w-full animate-pulse items-center justify-center rounded-md bg-gold/10">
                    <QrCode className="h-12 w-12 text-gold/40" />
                  </div>
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code for ${destination.label} — ${shareUrl}`}
                    className="h-full w-full rounded-md"
                    width={288}
                    height={288}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-md bg-clay/10 px-3 text-center font-sans text-xs text-clay/70">
                    <QrCode className="mb-2 h-8 w-8 opacity-60" />
                    QR unavailable — try another destination.
                  </div>
                )}
              </div>

              <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-gold-muted">
                {destination.label}
              </p>
              <p className="text-center font-sans text-xs text-espresso/65">
                {destination.description}
              </p>

              {/* Download + Print */}
              <div className="flex w-full flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={!qrDataUrl}
                  className="flex-1 border-gold/40 text-espresso hover:bg-gold/10 hover:text-espresso"
                >
                  <Download className="mr-1.5 size-3.5" />
                  Download PNG
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  disabled={!qrDataUrl}
                  className="flex-1 border-gold/40 text-espresso hover:bg-gold/10 hover:text-espresso"
                >
                  <Printer className="mr-1.5 size-3.5" />
                  Print
                </Button>
              </div>
            </div>

            {/* RIGHT: link + destination + share */}
            <div className="flex flex-col gap-4">
              {/* Destination selector */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] uppercase tracking-[0.22em] text-gold-muted">
                  Destination
                </label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-gold/30 bg-white/70 px-3 py-2.5 text-left font-sans text-sm text-espresso transition-colors hover:bg-white"
                    >
                      <span className="flex items-center gap-2">
                        <destination.icon className="size-4 text-gold" />
                        <span className="font-medium">{destination.label}</span>
                      </span>
                      <ChevronDown className="size-4 text-espresso/50" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-[min(28rem,calc(100vw-3rem))] border-gold/30 bg-champagne text-espresso"
                  >
                    <DropdownMenuLabel className="font-sans text-[10px] uppercase tracking-[0.22em] text-gold-muted">
                      Pick a destination
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-gold/20" />
                    {DESTINATIONS.map((d) => {
                      const Icon = d.icon;
                      const active = d.key === destination.key;
                      return (
                        <DropdownMenuItem
                          key={d.key}
                          onSelect={() => onSelectDestination(d)}
                          className="gap-2.5 py-2.5 focus:bg-gold/10 focus:text-espresso"
                        >
                          <Icon className={`size-4 ${active ? 'text-gold' : 'text-espresso/60'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="font-sans text-sm font-medium">{d.label}</p>
                            <p className="font-sans text-[11px] text-espresso/55">{d.description}</p>
                          </div>
                          {active && <Check className="size-4 text-gold" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* URL + copy */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] uppercase tracking-[0.22em] text-gold-muted">
                  Wedding link
                </label>
                <div className="flex items-stretch gap-2">
                  <div className="min-w-0 flex-1 truncate rounded-md border border-gold/30 bg-white/70 px-3 py-2 font-mono text-xs text-espresso/80">
                    {shareUrl}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopy}
                    aria-label="Copy link"
                    className="border-gold/40 bg-espresso text-champagne hover:bg-espresso/90"
                  >
                    {copied ? (
                      <>
                        <Check className="mr-1 size-3.5 text-sage-light" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 size-3.5" /> Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Share actions */}
              <div>
                <label className="mb-1.5 block font-sans text-[11px] uppercase tracking-[0.22em] text-gold-muted">
                  Share via
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleWhatsApp}
                    className="border-transparent text-white hover:brightness-105"
                    style={{ background: '#25D366' }}
                  >
                    <MessageCircle className="mr-1.5 size-3.5" />
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleTelegram}
                    className="border-transparent text-white hover:brightness-105"
                    style={{ background: '#0088CC' }}
                  >
                    <Send className="mr-1.5 size-3.5" />
                    Telegram
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleEmail}
                    variant="outline"
                    className="border-gold/40 text-espresso hover:bg-gold/10 hover:text-espresso"
                  >
                    <Mail className="mr-1.5 size-3.5" />
                    Email
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNativeShare}
                    disabled={!canShare}
                    variant="outline"
                    className="border-gold/40 text-espresso hover:bg-gold/10 hover:text-espresso disabled:opacity-50"
                  >
                    <Share2 className="mr-1.5 size-3.5" />
                    {canShare ? 'Share' : 'No native'}
                  </Button>
                </div>
              </div>

              {/* Open in new tab */}
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 font-sans text-xs text-gold-muted underline-offset-2 hover:text-gold hover:underline"
              >
                <ExternalLink className="size-3" />
                Open destination in a new tab
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default QrGateway;
