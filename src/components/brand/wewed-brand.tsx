import type { CSSProperties } from 'react'

export type WewedBrandTone = 'dark' | 'light'

// These are direct derivatives of the approved master Wewed artwork.
// Do not redraw the mark or re-typeset the wordmark in UI components.
const MARK_SRC = '/brand/wewed-mark-master.jpg'
const WORDMARK_SRC = '/brand/wewed-wordmark-master.jpg'

export function WewedBrandMark({
  className = '',
  title = 'Wewed',
}: {
  className?: string
  title?: string
}) {
  return (
    <span
      className={`inline-flex overflow-hidden rounded-lg bg-white ${className}`}
      data-wewed-brand-source="approved-master"
    >
      <img
        src={MARK_SRC}
        alt={title}
        className="h-full w-full object-contain"
        draggable={false}
      />
    </span>
  )
}

const sizeStyles: Record<'compact' | 'default' | 'hero', CSSProperties> = {
  compact: {
    '--wewed-brand-mark-h': '2.15rem',
    '--wewed-brand-word-w': '4.7rem',
  } as CSSProperties,
  default: {
    '--wewed-brand-mark-h': '2.8rem',
    '--wewed-brand-word-w': '5.9rem',
  } as CSSProperties,
  hero: {
    '--wewed-brand-mark-h': '4.25rem',
    '--wewed-brand-word-w': '8.4rem',
  } as CSSProperties,
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
  const descriptorColor = tone === 'dark' ? 'text-espresso/60' : 'text-espresso/58'

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2 rounded-xl border border-gold/20 bg-white px-1.5 py-1 shadow-[0_8px_24px_-15px_rgba(26,20,16,0.72)] ${className}`}
      style={sizeStyles[size]}
      data-wewed-brand="lockup"
      data-wewed-brand-source="approved-master"
    >
      <WewedBrandMark
        className="shrink-0"
        title={compact ? 'Wewed' : ''}
      />
      <style>{`[data-wewed-brand='lockup'] > [data-wewed-brand-source='approved-master']:first-child { height: var(--wewed-brand-mark-h); width: calc(var(--wewed-brand-mark-h) * 1.407); }`}</style>
      {!compact && (
        <span className="min-w-0 pr-1">
          <img
            src={WORDMARK_SRC}
            alt="Wewed"
            className="block h-auto max-w-full object-contain"
            style={{ width: 'var(--wewed-brand-word-w)' } as CSSProperties}
            draggable={false}
          />
          {descriptor && (
            <span className={`mt-0.5 block truncate text-[0.55rem] font-semibold uppercase tracking-[0.16em] ${descriptorColor}`}>
              {descriptor}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
