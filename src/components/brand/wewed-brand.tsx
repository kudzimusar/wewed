import type { CSSProperties } from 'react'

export type WewedBrandTone = 'dark' | 'light'

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
      className={`inline-flex overflow-hidden rounded-[0.65rem] border border-gold/20 bg-white shadow-[0_5px_18px_-10px_rgba(26,20,16,0.7)] ${className}`}
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
    '--wewed-brand-mark-h': '2.35rem',
    '--wewed-brand-word-w': '4.8rem',
  } as CSSProperties,
  default: {
    '--wewed-brand-mark-h': '3rem',
    '--wewed-brand-word-w': '6rem',
  } as CSSProperties,
  hero: {
    '--wewed-brand-mark-h': '4.5rem',
    '--wewed-brand-word-w': '8.6rem',
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
  const descriptorColor = tone === 'dark' ? 'text-champagne/58' : 'text-espresso/55'

  return (
    <span
      className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}
      style={sizeStyles[size]}
      data-wewed-brand="lockup"
      data-wewed-brand-source="approved-master"
    >
      <WewedBrandMark
        className="shrink-0"
        title={compact ? 'Wewed' : ''}
      />
      <style>{`[data-wewed-brand='lockup'] > [data-wewed-brand-source='approved-master']:first-child { height: var(--wewed-brand-mark-h); width: calc(var(--wewed-brand-mark-h) * 1.414); }`}</style>
      {!compact && (
        <span className="min-w-0">
          <span className="inline-flex max-w-full overflow-hidden rounded-lg border border-gold/15 bg-white px-1.5 py-0.5 shadow-[0_4px_16px_-11px_rgba(26,20,16,0.72)]">
            <img
              src={WORDMARK_SRC}
              alt="Wewed"
              className="block h-auto max-w-full object-contain"
              style={{ width: 'var(--wewed-brand-word-w)' } as CSSProperties}
              draggable={false}
            />
          </span>
          {descriptor && (
            <span className={`mt-1 block truncate text-[0.58rem] font-semibold uppercase tracking-[0.17em] ${descriptorColor}`}>
              {descriptor}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
