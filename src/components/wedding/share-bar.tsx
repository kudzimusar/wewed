'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mail, Check, Copy } from 'lucide-react';
import {
  SOCIAL_PLATFORMS,
  SHARE_BAR_ORDER,
  WEDED_SHARE_URL,
  WEDED_SHARE_BODY,
  type SocialPlatform,
  type SocialPlatformKey,
  copyToClipboard,
} from '@/lib/social';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

/* ============================================================
   ShareBar — horizontal row of social share buttons
   ------------------------------------------------------------
   Each platform renders a circular brand-colored button with
   hover tooltip + framer-motion scale. WhatsApp & Telegram
   pre-fill the full wedding message; "Copy Link" copies the
   canonical URL and toasts "Copied!" with a gold check.
   ============================================================ */

export interface ShareBarProps {
  /** Pre-filled message (defaults to the canonical wewed body). */
  message?: string;
  /** URL to share (defaults to the canonical wedding URL). */
  url?: string;
  /** Compact = icon-only; expanded = icon + label. */
  variant?: 'compact' | 'expanded';
  /** Optional className on the wrapping flex container. */
  className?: string;
  /** Show tooltips on hover (default true). */
  showTooltips?: boolean;
  /** Phone for direct WhatsApp destination (defaults to couple's). */
  phone?: string;
}

/* ── Brand SVG icon (renders paths from SOCIAL_PLATFORMS) ── */
function BrandIcon({
  platform,
  className,
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  // Special multi-tone render for TikTok (cyan + pink accent)
  if (platform.key === 'tiktok') {
    return (
      <svg
        viewBox={platform.iconViewBox}
        className={className}
        fill="currentColor"
        aria-hidden="true"
      >
        {/* Offset cyan shadow */}
        <path
          d={platform.iconPaths[0]}
          fill="#25F4EE"
          transform="translate(-1.4 -1.2)"
          opacity="0.9"
        />
        {/* Offset pink shadow */}
        <path
          d={platform.iconPaths[0]}
          fill="#FE2C55"
          transform="translate(1.4 1.2)"
          opacity="0.9"
        />
        {/* Main white(ish) glyph — uses currentColor */}
        <path d={platform.iconPaths[0]} fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg
      viewBox={platform.iconViewBox}
      className={className}
      fill="currentColor"
      fillRule={platform.iconFillRule || 'nonzero'}
      aria-hidden="true"
    >
      {platform.iconPaths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/* ── Per-button styling (brand color on hover, ivory default) ── */
function buttonClasses(platform: SocialPlatform): string {
  // Base ring + transition
  const base =
    'group relative inline-flex items-center justify-center rounded-full transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-champagne';

  if (platform.key === 'instagram') {
    return `${base} text-espresso/70 hover:text-white`;
  }
  if (platform.key === 'email' || platform.key === 'copy') {
    return `${base} text-espresso/70 hover:text-espresso`;
  }
  return `${base} text-espresso/70 hover:text-white`;
}

function buttonBgStyle(platform: SocialPlatform): React.CSSProperties {
  if (platform.key === 'instagram') {
    return { background: 'transparent' };
  }
  return { background: 'transparent' };
}

/* ── Individual share button ── */
function ShareButton({
  platformKey,
  message,
  url,
  phone,
  variant,
  showTooltip,
  onCopied,
}: {
  platformKey: SocialPlatformKey;
  message: string;
  url: string;
  phone?: string;
  variant: 'compact' | 'expanded';
  showTooltip: boolean;
  onCopied?: (ok: boolean) => void;
}) {
  const platform = SOCIAL_PLATFORMS[platformKey];
  const isWhatsApp = platformKey === 'whatsapp';
  const isTelegram = platformKey === 'telegram';
  const isCopy = platformKey === 'copy';
  const isEmail = platformKey === 'email';

  // WhatsApp & Telegram use the full pre-filled body.
  const shareText =
    isWhatsApp || isTelegram ? message : `Charity & Kudzie are getting married! 🎉 ${message.split('RSVP')[0]}`.trim();

  const handleClick = useCallback(async () => {
    if (isCopy) {
      const ok = await copyToClipboard(url);
      onCopied?.(ok);
      return;
    }

    // WhatsApp: if a `phone` prop is supplied, open a direct chat with that
    // number (used by the RSVP flow). Otherwise open the WhatsApp share sheet
    // so the guest picks who to forward the invite to.
    const destPhone = isWhatsApp ? phone : undefined;
    const shareUrl = platform.share({
      text: isWhatsApp ? message : shareText,
      url,
      phone: destPhone,
    });
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=720,height=620');
  }, [isCopy, isWhatsApp, platform, message, shareText, url, phone, onCopied]);

  // Size by variant
  const sizeClasses =
    variant === 'compact' ? 'h-11 w-11' : 'h-11 w-11 sm:h-12 sm:w-12';
  const iconSize = variant === 'compact' ? 'h-5 w-5' : 'h-5 w-5 sm:h-[22px] sm:w-[22px]';

  const button = (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-label={isCopy ? 'Copy wedding link to clipboard' : `Share via ${platform.name}`}
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      className={`${buttonClasses(platform)} ${sizeClasses} border border-gold/30 bg-white/70 backdrop-blur-sm hover:border-transparent`}
      style={buttonBgStyle(platform)}
    >
      {/* Hover wash — brand color or gradient */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            platform.gradient ||
            (platform.key === 'email'
              ? 'linear-gradient(135deg, #BF9B5F, #D8BC7E)'
              : platform.color),
        }}
      />

      {/* Icon */}
      <span className="relative z-10 flex items-center justify-center">
        {isEmail ? (
          <Mail className={iconSize} strokeWidth={1.75} />
        ) : isCopy ? (
          <Copy className={iconSize} strokeWidth={1.75} />
        ) : (
          <BrandIcon platform={platform} className={iconSize} />
        )}
      </span>

      {/* Expanded label */}
      {variant === 'expanded' && (
        <span className="sr-only sm:not-sr-only sm:ml-0 sm:text-[0px]">
          {platform.name}
        </span>
      )}
    </motion.button>
  );

  if (!showTooltip) {
    return <div className="relative">{button}</div>;
  }

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <div className="relative">{button}</div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="border-gold/30 bg-espresso text-champagne font-sans text-xs"
      >
        {isCopy ? 'Copy link' : platform.name}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Main ShareBar ── */
export function ShareBar({
  message = WEDED_SHARE_BODY,
  url = WEDED_SHARE_URL,
  variant = 'compact',
  className = '',
  showTooltips = true,
  phone,
}: ShareBarProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopied = useCallback(
    (ok: boolean) => {
      if (ok) {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
        toast({
          title: 'Link copied!',
          description: 'Paste it anywhere to invite someone to celebrate.',
        });
      } else {
        toast({
          title: 'Copy failed',
          description: 'Your browser blocked clipboard access.',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const buttons = useMemo(
    () =>
      SHARE_BAR_ORDER.map((key) => (
        <ShareButton
          key={key}
          platformKey={key}
          message={message}
          url={url}
          phone={phone}
          variant={variant}
          showTooltip={showTooltips}
          onCopied={handleCopied}
        />
      )),
    [message, url, phone, variant, showTooltips, handleCopied]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="group"
        aria-label="Share this wedding"
        className={`flex flex-wrap items-center gap-2.5 rounded-2xl border border-gold/40 bg-champagne/60 p-3 backdrop-blur-sm sm:gap-3 sm:p-4 ${className}`}
      >
        {buttons}
        {/* Copied checkmark — appears briefly when Copy Link is clicked */}
        {copied && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="ml-1 inline-flex h-7 items-center gap-1 rounded-full bg-gold/20 px-2.5 font-sans text-xs font-semibold text-gold"
            aria-live="polite"
          >
            <Check className="h-3.5 w-3.5" />
            Copied
          </motion.span>
        )}
      </div>
    </TooltipProvider>
  );
}

export default ShareBar;
