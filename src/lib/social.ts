'use client';

import { useState, useEffect } from 'react';

/* ============================================================
   wewed — Social Sharing & Messaging Helpers
   ------------------------------------------------------------
   Canonical share URL, pre-filled message templates, and URL
   builders for every platform wewed markets through:
   WhatsApp, Telegram, Facebook, Twitter/X, LinkedIn, Pinterest,
   Email, SMS, plus a native Web Share API hook + clipboard.
   ============================================================ */

// ─── Canonical wedding share URL ─────────────────────────────
export const WEDED_SHARE_URL = 'https://wewed.pro/charity-and-kudzie';

// ─── Default share copy (used by every platform unless overridden)
export const WEDED_SHARE_TEXT =
  "You're invited to Charity & Kudzie's wedding! 🎉 December 23, 2026 at Imba Manor, Harare. Join us: ";

// ─── Full pre-filled WhatsApp / Telegram body ────────────────
// (Telegram has a 4096-char limit; WhatsApp ~ 4096. Plenty of headroom.)
export const WEDED_SHARE_BODY = `You're invited to Charity & Kudzie's wedding! 🎉 Dec 23, 2026 at Imba Manor, Harare. RSVP here: ${WEDED_SHARE_URL}`;

// ─── Couple's WhatsApp (placeholder — Phase 5: move to DB) ────
// International format, no "+", no spaces — wa.me friendly.
export const COUPLE_WHATSAPP_NUMBER = '263771234567';
export const COUPLE_WHATSAPP_DISPLAY = '+263 77 123 4567';

// ─── Telegram channel & bot (placeholders) ───────────────────
export const TELEGRAM_CHANNEL = 'https://t.me/wewedcharitykudzie';
export const TELEGRAM_CHANNEL_HANDLE = '@wewedcharitykudzie';

// ─── Social handles for the "Follow our journey" row ────────
export const SOCIAL_HANDLES = {
  instagram: undefined,
  facebook: undefined,
  twitter: 'https://twitter.com/wewed_app',
  tiktok: undefined,
} as const;

// ─── URL Builders ───────────────────────────────────────────

/**
 * Build a wa.me deep link with an optional pre-filled message and
 * optional destination phone (international format, digits only).
 * If `phone` is omitted the link opens WhatsApp with the message
 * in the share sheet so the user picks a chat.
 */
export function buildWhatsAppUrl(message: string, phone?: string): string {
  const text = encodeURIComponent(message);
  const digits = phone?.replace(/[^\d]/g, '');
  const base = digits ? `https://wa.me/${digits}` : 'https://wa.me/';
  const qs = text ? `?text=${text}` : '';
  return `${base}${qs}`;
}

/**
 * Build a Telegram share URL (t.me/share/url) with pre-filled text.
 * Telegram accepts `url` and `text` separately; we combine them.
 */
export function buildTelegramUrl(message: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(
    WEDED_SHARE_URL
  )}&text=${encodeURIComponent(message)}`;
}

/**
 * Facebook sharer. Accepts an optional `quote` (Facebook has
 * deprecated quote in modern deployments but it is harmless).
 */
export function buildFacebookUrl(url: string, quote?: string): string {
  const u = encodeURIComponent(url);
  const q = quote ? `&quote=${encodeURIComponent(quote)}` : '';
  return `https://www.facebook.com/sharer/sharer.php?u=${u}${q}`;
}

/** Twitter / X intent URL with pre-filled text + URL. */
export function buildTwitterUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text
  )}&url=${encodeURIComponent(url)}`;
}

/** LinkedIn sharing URL with title (and url). */
export function buildLinkedInUrl(url: string, title: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    url
  )}&title=${encodeURIComponent(title)}`;
}

/** Pinterest "create pin" URL with image-less fallback (description + url). */
export function buildPinterestUrl(url: string, description: string): string {
  return `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(
    url
  )}&description=${encodeURIComponent(description)}`;
}

/** mailto: with subject + body. */
export function buildEmailUrl(subject: string, body: string): string {
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    body
  )}`;
}

/**
 * sms: URL. Uses `&` for body on iOS and `?` on Android — the
 * `&body=` form works on most modern browsers; we use the
 * cross-platform `?body=` which iOS 14+ also accepts.
 */
export function buildSmsUrl(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return `sms:${digits}?&body=${encodeURIComponent(message)}`;
}

// ─── Clipboard ──────────────────────────────────────────────

/**
 * Copy text to the clipboard. Uses the async Clipboard API when
 * available, with a legacy `execCommand` fallback for older /
 * insecure contexts. Resolves to `true` on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }

  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ─── Native Web Share API hook ──────────────────────────────

export type NativeShareResult = 'shared' | 'copied' | 'failed' | 'cancelled';

export interface NativeShareOptions {
  title?: string;
  text?: string;
  url?: string;
}

/**
 * useNativeShare — returns `{ canShare, share }`.
 *  - `canShare` is true when `navigator.share` exists (mobile /
 *    desktop browsers with Web Share support).
 *  - `share()` invokes the native sheet; if unavailable or aborted
 *    for a non-user reason, it falls back to copying the URL to
 *    the clipboard. Resolves with a status string so callers can
 *    toast the right message.
 *
 * IMPORTANT: `canShare` starts as `false` on both server and first client
 * render, then flips to its true value inside a `useEffect`. This avoids a
 * hydration mismatch: SSR renders `canShare=false` (no Share button); the
 * first client render also renders `canShare=false` (matches SSR); then
 * React commits the effect and re-renders with the real value. The Share
 * button (if supported) appears a frame later — invisible to users.
 */
export function useNativeShare() {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(
      typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function'
    );
  }, []);

  async function share(opts: NativeShareOptions): Promise<NativeShareResult> {
    const { title, text, url } = opts;
    const fallbackText = [text, url].filter(Boolean).join(' ') || url || '';

    // Read the live capability at call time (canShare state may lag by a frame).
    const supported =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function';

    if (supported) {
      try {
        await navigator.share({ title, text, url });
        return 'shared';
      } catch (err) {
        const name = (err as DOMException)?.name;
        if (name === 'AbortError') return 'cancelled';
        // any other error → fall through to clipboard
      }
    }

    const ok = await copyToClipboard(fallbackText);
    return ok ? 'copied' : 'failed';
  }

  return { canShare, share };
}

// ─── Social platform config ─────────────────────────────────

export type SocialPlatformKey =
  | 'whatsapp'
  | 'telegram'
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'tiktok'
  | 'linkedin'
  | 'pinterest'
  | 'email'
  | 'sms'
  | 'copy';

export interface ShareOpts {
  url: string;
  text: string;
  /** Optional phone for direct WhatsApp / SMS destinations. */
  phone?: string;
}

export interface SocialPlatform {
  key: SocialPlatformKey;
  name: string;
  /** Brand color (hex) — used for hover bg / icon tint. */
  color: string;
  /** Optional CSS gradient for branded buttons (Instagram, TikTok). */
  gradient?: string;
  /** viewBox for the icon SVG. */
  iconViewBox: string;
  /** Array of SVG path `d` attributes that compose the brand mark. */
  iconPaths: string[];
  /** Default fill rule — 'evenodd' for stencil-style logos (WhatsApp, Telegram). */
  iconFillRule?: 'nonzero' | 'evenodd';
  /** Follow URL (for the "follow our journey" row). Optional. */
  followUrl?: string;
  /** Display handle when a verified Wewed profile is configured. */
  handle?: string;
  /** Builds the share URL for this platform. */
  share: (opts: ShareOpts) => string;
  /** Whether this platform opens a share sheet (true) or a follow page (false). */
  isShareable: boolean;
}

/**
 * SOCIAL_PLATFORMS — every platform wewed integrates with.
 * Icons are stored as raw SVG path data so this file stays
 * framework-agnostic (no JSX). Components render them via
 * `<svg viewBox={p.iconViewBox}>{p.iconPaths.map(d => <path d={d}/>)}</svg>`.
 */
export const SOCIAL_PLATFORMS: Record<SocialPlatformKey, SocialPlatform> = {
  whatsapp: {
    key: 'whatsapp',
    name: 'WhatsApp',
    color: '#25D366',
    iconViewBox: '0 0 24 24',
    iconFillRule: 'evenodd',
    iconPaths: [
      'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z',
    ],
    followUrl: undefined, // WhatsApp has no "follow" page
    share: ({ text, phone }) => buildWhatsAppUrl(text, phone),
    isShareable: true,
  },

  telegram: {
    key: 'telegram',
    name: 'Telegram',
    color: '#0088cc',
    iconViewBox: '0 0 24 24',
    iconFillRule: 'evenodd',
    iconPaths: [
      'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.061 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
    ],
    followUrl: TELEGRAM_CHANNEL,
    handle: TELEGRAM_CHANNEL_HANDLE,
    share: ({ text }) => buildTelegramUrl(text),
    isShareable: true,
  },

  facebook: {
    key: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    iconViewBox: '0 0 24 24',
    iconFillRule: 'evenodd',
    iconPaths: [
      'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
    ],
    followUrl: SOCIAL_HANDLES.facebook,
    handle: undefined,
    share: ({ url, text }) => buildFacebookUrl(url, text),
    isShareable: true,
  },

  twitter: {
    key: 'twitter',
    name: 'X (Twitter)',
    color: '#000000',
    iconViewBox: '0 0 24 24',
    iconPaths: [
      'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z',
    ],
    followUrl: SOCIAL_HANDLES.twitter,
    handle: '@wewed_app',
    share: ({ text, url }) => buildTwitterUrl(text, url),
    isShareable: true,
  },

  instagram: {
    key: 'instagram',
    name: 'Instagram',
    color: '#E4405F',
    gradient: 'linear-gradient(135deg, #E4405F 0%, #F77737 25%, #FCAF45 50%, #833AB4 100%)',
    iconViewBox: '0 0 24 24',
    iconFillRule: 'evenodd',
    iconPaths: [
      'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0Zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227a3.81 3.81 0 0 1-.899 1.382 3.744 3.744 0 0 1-1.38.896c-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421a3.716 3.716 0 0 1-1.379-.899 3.744 3.744 0 0 1-.9-1.38c-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03Zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.846-10.405a1.441 1.441 0 0 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z',
    ],
    followUrl: SOCIAL_HANDLES.instagram,
    handle: undefined,
    // Instagram has no web share intent — opens the follow page.
    share: ({ url }) => url,
    isShareable: false,
  },

  tiktok: {
    key: 'tiktok',
    name: 'TikTok',
    color: '#000000',
    // Cyan + pink accent overlay is applied in the component.
    iconViewBox: '0 0 24 24',
    iconPaths: [
      'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
    ],
    followUrl: SOCIAL_HANDLES.tiktok,
    handle: undefined,
    share: ({ url }) => url,
    isShareable: false,
  },

  linkedin: {
    key: 'linkedin',
    name: 'LinkedIn',
    color: '#0A66C2',
    iconViewBox: '0 0 24 24',
    iconFillRule: 'evenodd',
    iconPaths: [
      'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    ],
    followUrl: 'https://linkedin.com/company/wewed',
    handle: 'linkedin.com/company/wewed',
    share: ({ url, text }) => buildLinkedInUrl(url, text),
    isShareable: true,
  },

  pinterest: {
    key: 'pinterest',
    name: 'Pinterest',
    color: '#BD081C',
    iconViewBox: '0 0 24 24',
    iconFillRule: 'evenodd',
    iconPaths: [
      'M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378l-.747 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z',
    ],
    followUrl: 'https://pinterest.com/wewed',
    handle: 'pinterest.com/wewed',
    share: ({ url, text }) => buildPinterestUrl(url, text),
    isShareable: true,
  },

  email: {
    key: 'email',
    name: 'Email',
    color: '#BF9B5F',
    iconViewBox: '0 0 24 24',
    iconPaths: [
      // Envelope icon (Lucide-style, stroke) — but stored as a filled-ish path
      // for consistency with the brand marks. Rendered with currentColor.
      'M1.5 8.67v8.58a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V8.67l-8.928 5.493a3 3 0 0 1-3.144 0L1.5 8.67Z',
      'M22.5 6.908V6.75a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3v.158l9.714 5.978a1.5 1.5 0 0 0 1.572 0L22.5 6.908Z',
    ],
    share: ({ text, url }) => buildEmailUrl("You're invited! 🎉", `${text}\n\n${url}`),
    isShareable: true,
  },

  sms: {
    key: 'sms',
    name: 'SMS',
    color: '#7C7A52',
    iconViewBox: '0 0 24 24',
    iconPaths: [
      'M12 2C6.477 2 2 5.97 2 10.5c0 2.43 1.293 4.61 3.34 6.106V21l3.05-1.74c1.16.32 2.4.49 3.61.49 5.523 0 10-3.97 10-8.5S17.523 2 12 2Zm1 11.5l-2.5-2.75L5.5 13.5l5-2.75L12 11l5 2.5-4 0Z',
    ],
    share: ({ text, phone }) => buildSmsUrl(phone || '', text),
    isShareable: true,
  },

  copy: {
    key: 'copy',
    name: 'Copy Link',
    color: '#1A1410',
    iconViewBox: '0 0 24 24',
    iconPaths: [
      'M13.5 6.75H7.5a.75.75 0 0 0-.75.75v10.5c0 .414.336.75.75.75h6a.75.75 0 0 0 .75-.75V7.5a.75.75 0 0 0-.75-.75Z',
      'M16.5 3.75H10.5a.75.75 0 0 0 0 1.5h6A.75.75 0 0 1 17.25 6v9a.75.75 0 0 0 1.5 0V6A2.25 2.25 0 0 0 16.5 3.75Z',
      'M7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V7.5A2.25 2.25 0 0 0 13.5 5.25h-6A2.25 2.25 0 0 0 5.25 7.5v11.25A2.25 2.25 0 0 0 7.5 21Z',
    ],
    share: ({ url }) => url,
    isShareable: true,
  },
};

/** Ordered list of platforms for the share bar (WhatsApp & Telegram first). */
export const SHARE_BAR_ORDER: SocialPlatformKey[] = [
  'whatsapp',
  'telegram',
  'facebook',
  'twitter',
  'instagram',
  'tiktok',
  'email',
  'copy',
];

/** Ordered list of platforms for the "Follow our journey" row. */
export const FOLLOW_ROW_ORDER: SocialPlatformKey[] = [
  'instagram',
  'facebook',
  'twitter',
  'tiktok',
];
