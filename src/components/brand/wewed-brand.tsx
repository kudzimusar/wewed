import type { CSSProperties } from 'react'

export type WewedBrandTone = 'dark' | 'light'

export function WewedBrandMark({
  className = '',
  title = 'Wewed',
}: {
  className?: string
  title?: string
}) {
  return (
    <svg
      viewBox="0 0 160 120"
      role="img"
      aria-label={title}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="wewed-gold" x1="18" y1="6" x2="140" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A68B4B" />
          <stop offset="0.36" stopColor="#F0D69A" />
          <stop offset="0.62" stopColor="#BF9B5F" />
          <stop offset="1" stopColor="#8A6D38" />
        </linearGradient>
        <linearGradient id="wewed-espresso" x1="22" y1="36" x2="137" y2="111" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2B211A" />
          <stop offset="0.56" stopColor="#1A1410" />
          <stop offset="1" stopColor="#090706" />
        </linearGradient>
        <filter id="wewed-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.6" floodColor="#090706" floodOpacity="0.25" />
        </filter>
      </defs>

      <g fill="none" stroke="url(#wewed-gold)" strokeLinecap="round" strokeLinejoin="round" filter="url(#wewed-shadow)">
        <circle cx="70" cy="18" r="10.5" strokeWidth="5" />
        <circle cx="88" cy="18" r="10.5" strokeWidth="5" />
        <path d="M94 7l6-4 6 5-5 8-8-1z" strokeWidth="2.4" />
        <path d="M101 4l-1 11M95 8l11 0" strokeWidth="1.2" opacity="0.75" />
      </g>

      <path
        d="M18 42c16 3 23 16 30 34 6 16 12 27 25 33L80 97 50 43c-3-6-9-9-15-9H18z"
        fill="url(#wewed-espresso)"
        stroke="url(#wewed-gold)"
        strokeWidth="2.4"
        strokeLinejoin="round"
        filter="url(#wewed-shadow)"
      />
      <path
        d="M142 42c-16 3-23 16-30 34-6 16-12 27-25 33L80 97l30-54c3-6 9-9 15-9h17z"
        fill="url(#wewed-espresso)"
        stroke="url(#wewed-gold)"
        strokeWidth="2.4"
        strokeLinejoin="round"
        filter="url(#wewed-shadow)"
      />

      <path
        d="M80 42C69 27 46 32 46 51c0 17 18 29 34 47 16-18 34-30 34-47 0-19-23-24-34-9z"
        fill="none"
        stroke="url(#wewed-gold)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#wewed-shadow)"
      />
      <path
        d="M80 45v50"
        stroke="url(#wewed-gold)"
        strokeWidth="2"
        opacity="0.55"
      />

      <g fill="url(#wewed-gold)" opacity="0.9">
        <path d="M27 48c-8-10-14-8-16-5 4 8 9 12 16 12z" />
        <path d="M31 58c-10-4-14 0-14 4 7 5 12 5 18 1z" />
        <path d="M133 48c8-10 14-8 16-5-4 8-9 12-16 12z" />
        <path d="M129 58c10-4 14 0 14 4-7 5-12 5-18 1z" />
      </g>
      <g stroke="#BF9B5F" strokeWidth="1.8" opacity="0.65">
        <path d="M31 43c-3 12 0 22 8 31" />
        <path d="M129 43c3 12 0 22-8 31" />
      </g>
    </svg>
  )
}

const sizeStyles: Record<'compact' | 'default' | 'hero', CSSProperties> = {
  compact: { '--wewed-brand-mark': '2.4rem', '--wewed-brand-word': '1.45rem' } as CSSProperties,
  default: { '--wewed-brand-mark': '3.25rem', '--wewed-brand-word': '2rem' } as CSSProperties,
  hero: { '--wewed-brand-mark': '4.75rem', '--wewed-brand-word': '3rem' } as CSSProperties,
}

export function WewedBrand({
  tone = 'dark',
  size = 'default',
  descriptor,
  compact = false,
  className = '',
}: {
  tone?: WewedBrandTone
  size?: 'compact' | 'default' | 'hero'
  descriptor?: string
  compact?: boolean
  className?: string
}) {
  const wordColor = tone === 'dark' ? 'text-champagne' : 'text-espresso'
  const descriptorColor = tone === 'dark' ? 'text-champagne/55' : 'text-espresso/52'

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}
      style={sizeStyles[size]}
      data-wewed-brand="lockup"
    >
      <span
        className="relative flex shrink-0 items-center justify-center overflow-visible"
        style={{ width: 'var(--wewed-brand-mark)', height: 'var(--wewed-brand-mark)' } as CSSProperties}
      >
        <WewedBrandMark className="h-[118%] w-[118%] overflow-visible" />
      </span>
      {!compact && (
        <span className="min-w-0 leading-none">
          <span
            className={`block truncate font-serif font-semibold tracking-[0.01em] ${wordColor}`}
            style={{ fontSize: 'var(--wewed-brand-word)' } as CSSProperties}
          >
            Wewed
          </span>
          {descriptor && (
            <span className={`mt-1 block truncate text-[0.62rem] font-semibold uppercase tracking-[0.2em] ${descriptorColor}`}>
              {descriptor}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
