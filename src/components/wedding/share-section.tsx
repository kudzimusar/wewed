'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Share2,
  Download,
  QrCode,
  Sparkles,
  Send,
  Heart,
  ExternalLink,
} from 'lucide-react';
import {
  WEDED_SHARE_URL,
  WEDED_SHARE_BODY,
  SOCIAL_PLATFORMS,
  FOLLOW_ROW_ORDER,
  SOCIAL_HANDLES,
  useNativeShare,
  buildWhatsAppUrl,
} from '@/lib/social';
import { ShareBar } from '@/components/wedding/share-bar';
import { GoldOrnament } from '@/components/wedding/decorative-elements';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { SectionInfo } from '@/components/wedding/section-info';

/* ============================================================
   ShareSection — full "Spread the Love" marketing block
   ------------------------------------------------------------
   - Editable share message (pre-filled with the canonical body)
   - ShareBar (all platforms)
   - Prominent green "Share via WhatsApp" CTA
   - Native Share sheet button (when supported)
   - QR code preview + download
   - "Follow our journey" social follow row
   ============================================================ */

const QR_ENDPOINT = '/api/qrcode';

interface QrResponse {
  success: boolean;
  qr?: string;
  meta?: { data: string; size: number };
  error?: string;
}

/** Fetch the QR code data URL from the wewed QR API. */
async function fetchQr(data: string, size = 320): Promise<string | null> {
  try {
    const url = `${QR_ENDPOINT}?data=${encodeURIComponent(data)}&size=${size}`;
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

/* ── Follow-row brand icon (re-uses SOCIAL_PLATFORMS paths) ── */
function FollowIcon({
  platformKey,
  className,
}: {
  platformKey: (typeof FOLLOW_ROW_ORDER)[number];
  className?: string;
}) {
  const p = SOCIAL_PLATFORMS[platformKey];
  if (platformKey === 'tiktok') {
    return (
      <svg viewBox={p.iconViewBox} className={className} fill="currentColor" aria-hidden="true">
        <path d={p.iconPaths[0]} fill="#25F4EE" transform="translate(-1.2 -1)" opacity="0.9" />
        <path d={p.iconPaths[0]} fill="#FE2C55" transform="translate(1.2 1)" opacity="0.9" />
        <path d={p.iconPaths[0]} fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      viewBox={p.iconViewBox}
      className={className}
      fill="currentColor"
      fillRule={p.iconFillRule || 'nonzero'}
      aria-hidden="true"
    >
      {p.iconPaths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function ShareSection() {
  const { toast } = useToast();
  const { canShare, share } = useNativeShare();

  const [message, setMessage] = useState(WEDED_SHARE_BODY);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(true);

  // Fetch QR for the canonical URL once on mount.
  useEffect(() => {
    let active = true;
    fetchQr(WEDED_SHARE_URL, 360)
      .then((d) => {
        if (active) {
          setQrDataUrl(d);
          setQrLoading(false);
        }
      })
      .catch(() => {
        if (active) setQrLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────
  const handleWhatsApp = useCallback(() => {
    // No destination phone → opens the WhatsApp share sheet so the
    // guest picks who to forward the invite to.
    const url = buildWhatsAppUrl(message);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [message]);

  const handleNativeShare = useCallback(async () => {
    const result = await share({
      title: "Charity & Kudzie's Wedding",
      text: message,
      url: WEDED_SHARE_URL,
    });
    if (result === 'shared') {
      toast({ title: 'Shared!', description: 'Thanks for spreading the love.' });
    } else if (result === 'copied') {
      toast({ title: 'Link copied!', description: 'Paste it anywhere to invite someone.' });
    }
  }, [message, share, toast]);

  const handleDownloadQr = useCallback(() => {
    if (!qrDataUrl) {
      toast({
        title: 'QR not ready',
        description: 'The QR code is still loading — try again in a moment.',
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
    a.download = 'wewed-charity-and-kudzie-qr.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objUrl);
    toast({ title: 'QR downloaded', description: 'Print it. Frame it. Mail it.' });
  }, [qrDataUrl, toast]);

  // ── Message preview (what guests see) ─────────────────────
  const preview = useMemo(() => message, [message]);

  const followCards = useMemo(
    () =>
      FOLLOW_ROW_ORDER.map((key) => {
        const p = SOCIAL_PLATFORMS[key];
        const href =
          (SOCIAL_HANDLES as Record<string, string>)[key] ||
          p.followUrl ||
          '#';
        return { key, platform: p, href };
      }),
    []
  );

  return (
    <section
      id="share-wedding"
     
      className="wewed-section relative bg-ivory py-20 sm:py-28"
      aria-labelledby="share-wedding-heading"
    >
      {/* Soft gold radial wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(191,155,95,0.10), transparent 60%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ── Heading ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <p className="wewed-monogram mb-3 font-sans text-xs uppercase tracking-[0.32em]">
            Spread the word
          </p>
          <h2
            id="share-wedding-heading"
            className="wewed-heading text-espresso text-4xl sm:text-5xl lg:text-6xl"
          >
            Spread the Love <SectionInfo text="Share this wedding website via WhatsApp, Telegram, Facebook, Twitter, Instagram, TikTok, or email. A QR code is available for download and printing. Use the native share sheet on mobile devices." />
          </h2>
          <GoldOrnament className="mx-auto mt-6 w-full max-w-[16rem]" height={20} />
          <p className="mx-auto mt-6 max-w-2xl font-sans text-base text-espresso/70 sm:text-lg">
            Know someone who should celebrate with us? Share our story — every
            invite plants a seed for a memory we&apos;ll all share.
          </p>
        </motion.div>

        {/* ── Main share card ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
          className="mt-12"
        >
          <Card className="overflow-hidden rounded-3xl border-gold/40 bg-white/80 p-0 shadow-[0_20px_60px_-30px_rgba(191,155,95,0.45)] backdrop-blur">
            <div className="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
              {/* ── LEFT: message preview ── */}
              <div className="relative border-b border-gold/20 p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <p className="mb-4 inline-flex items-center gap-2 font-sans text-xs uppercase tracking-[0.22em] text-gold-muted">
                  <Sparkles className="h-3.5 w-3.5" />
                  Preview
                </p>
                {/* Mock chat bubble */}
                <div className="relative rounded-2xl rounded-bl-sm bg-champagne p-5 shadow-inner ring-1 ring-gold/15">
                  <p className="font-sans text-[15px] leading-relaxed text-espresso whitespace-pre-wrap">
                    {preview}
                  </p>
                  <p className="mt-3 font-sans text-[11px] uppercase tracking-[0.18em] text-espresso/45">
                    What your guests will receive
                  </p>
                </div>

                {/* QR code */}
                <div className="mt-6 flex items-center gap-5">
                  <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-champagne p-2">
                    {qrLoading ? (
                      <div className="flex h-full w-full animate-pulse items-center justify-center rounded-md bg-gold/10">
                        <QrCode className="h-8 w-8 text-gold/40" />
                      </div>
                    ) : qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR code linking to the Charity & Kudzie wedding website"
                        className="h-full w-full rounded-md"
                        width={112}
                        height={112}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-md bg-clay/10 text-center font-sans text-[10px] text-clay/70">
                        QR unavailable
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-serif text-lg text-espresso">
                      Scan to celebrate
                    </p>
                    <p className="mt-1 font-sans text-xs text-espresso/60">
                      Point any phone camera at the code — it opens the wedding
                      page instantly.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadQr}
                      disabled={!qrDataUrl}
                      className="mt-3 border-gold/40 text-espresso hover:bg-gold/10 hover:text-espresso"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download QR
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── RIGHT: composer + share actions ── */}
              <div className="p-6 sm:p-8">
                <label
                  htmlFor="share-message"
                  className="mb-2 block font-sans text-xs uppercase tracking-[0.22em] text-gold-muted"
                >
                  Your message
                </label>
                <Textarea
                  id="share-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={600}
                  className="resize-none border-gold/25 bg-champagne/50 font-sans text-[15px] text-espresso placeholder:text-espresso/40 focus-visible:ring-gold"
                  placeholder="Write a personal note to your guests…"
                />
                <div className="mt-1 flex items-center justify-between">
                  <p className="font-sans text-[11px] text-espresso/45">
                    {message.length}/600
                  </p>
                  <button
                    type="button"
                    onClick={() => setMessage(WEDED_SHARE_BODY)}
                    className="font-sans text-[11px] text-gold-muted underline-offset-2 hover:text-gold hover:underline"
                  >
                    Reset to default
                  </button>
                </div>

                {/* ShareBar */}
                <div className="mt-5">
                  <p className="mb-2 font-sans text-xs uppercase tracking-[0.22em] text-gold-muted">
                    Share via
                  </p>
                  <ShareBar
                    message={message}
                    url={WEDED_SHARE_URL}
                    variant="compact"
                    showTooltips
                  />
                </div>

                {/* Primary CTAs */}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    onClick={handleWhatsApp}
                    className="flex-1 border-transparent text-white shadow-md transition-all hover:brightness-105 active:scale-[0.98]"
                    style={{ background: '#25D366' }}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Share via WhatsApp
                  </Button>
                  {canShare && (
                    <Button
                      type="button"
                      onClick={handleNativeShare}
                      variant="outline"
                      className="flex-1 border-gold/40 text-espresso hover:bg-gold/10 hover:text-espresso"
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* ── Follow our journey ── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 text-center"
        >
          <div className="mx-auto mb-6 flex max-w-md items-center justify-center">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/40" />
            <Heart className="mx-4 h-4 w-4 text-clay" />
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/40" />
          </div>
          <h3 className="wewed-heading text-espresso text-2xl sm:text-3xl">
            Follow our journey
          </h3>
          <p className="mx-auto mt-3 max-w-xl font-sans text-sm text-espresso/65">
            Behind-the-scenes moments, vendor shoutouts, and the road to &ldquo;I
            do&rdquo; — follow @wewed.app on your favourite platform.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {followCards.map(({ key, platform, href }, idx) => (
              <motion.a
                key={key}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Follow wewed on ${platform.name}`}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: idx * 0.06 }}
                whileHover={{ y: -3, scale: 1.04 }}
                className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-gold/30 bg-white shadow-sm transition-colors"
                style={{ color: platform.color }}
              >
                {/* Hover wash */}
                <span
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: platform.gradient || platform.color }}
                />
                <span className="relative z-10 flex items-center justify-center text-espresso/70 transition-colors group-hover:text-white">
                  <FollowIcon platformKey={key} className="h-6 w-6" />
                </span>
                <ExternalLink className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 text-gold opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.a>
            ))}
          </div>

          <p className="mt-6 font-sans text-xs text-espresso/50">
            {WEDED_SHARE_URL}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ── Helper: resolve follow URL per platform ── */
export default ShareSection;
