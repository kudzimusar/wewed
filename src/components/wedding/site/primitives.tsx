'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import type { PublicSiteItem, SiteSectionKey } from '@/lib/wedding-site/model'

/**
 * QRO07-SHIP01 — shared building blocks for the canonical wedding website.
 *
 * Every section reads ONLY the server projection (Couple/Wedding facts, published site copy,
 * enabled WeddingSiteItem rows, ProgrammeItem, MediaItem). Nothing here carries example or
 * fallback content: an empty section is hidden from guests, and an owner/planner (canEditSite,
 * resolved on the server) sees an honest prompt pointing at the site editor instead.
 */

const EASE = [0.22, 1, 0.36, 1] as const

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

/** Published copy for a public scalar field, or '' when unpublished. Never a default. */
export function usePublishedCopy(section: string, field: string): string {
  const { content } = useWeddingContext()
  return content[section]?.[field]?.trim() ?? ''
}

export function useSiteItems(section: SiteSectionKey): PublicSiteItem[] {
  return useWeddingContext().siteItems(section)
}

export function SiteSection({
  id,
  eyebrow,
  heading,
  subtitle,
  tone = 'ivory',
  children,
  labelledBy,
}: {
  id: string
  eyebrow?: string
  heading: string
  subtitle?: string
  tone?: 'ivory' | 'champagne' | 'espresso'
  children: ReactNode
  labelledBy?: string
}) {
  const headingId = labelledBy ?? `${id}-heading`
  // An eyebrow that merely repeats the heading adds noise; show it only when it adds context.
  const showEyebrow = Boolean(eyebrow && eyebrow.trim().toLowerCase() !== heading.trim().toLowerCase())
  const surface =
    tone === 'espresso'
      ? 'bg-espresso text-champagne'
      : tone === 'champagne'
        ? 'bg-champagne/60 text-espresso'
        : 'bg-ivory text-espresso'
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`wewed-section scroll-mt-20 py-20 sm:py-24 md:py-32 ${surface}`}
      data-site-section={id}
    >
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <Reveal className="mb-12 text-center sm:mb-16">
          {showEyebrow ? (
            <p
              className={`mb-4 font-sans text-[11px] font-medium uppercase tracking-[0.32em] ${
                tone === 'espresso' ? 'text-gold/80' : 'text-gold-muted'
              }`}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2
            id={headingId}
            className={`wewed-heading text-balance text-3xl font-light leading-tight sm:text-4xl md:text-5xl ${
              tone === 'espresso' ? 'text-champagne' : 'text-espresso'
            }`}
          >
            {heading}
          </h2>
          <div className="mx-auto mt-6 flex items-center justify-center gap-3" aria-hidden="true">
            <span className="h-px w-10 bg-gold/40 sm:w-16" />
            <span className="text-[10px] text-gold">&#9670;</span>
            <span className="h-px w-10 bg-gold/40 sm:w-16" />
          </div>
          {subtitle ? (
            <p
              className={`mx-auto mt-6 max-w-2xl text-pretty font-serif text-base italic leading-relaxed sm:text-lg ${
                tone === 'espresso' ? 'text-champagne/75' : 'text-espresso/65'
              }`}
            >
              {subtitle}
            </p>
          ) : null}
        </Reveal>
        {children}
      </div>
    </section>
  )
}

/**
 * Shown only to a server-resolved editor when a section has nothing published yet. Guests never
 * see it: for them the section is simply absent.
 */
export function OwnerSetupPrompt({ section, message }: { section: string; message: string }) {
  const { canEditSite, slug } = useWeddingContext()
  if (!canEditSite) return null
  return (
    <section
      id={`${section}-setup`}
      data-owner-setup={section}
      className="bg-ivory px-5 py-10 sm:px-8"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-gold/40 bg-champagne/40 p-6 text-center">
        <p className="font-sans text-[11px] font-medium uppercase tracking-[0.28em] text-gold-muted">
          Only you can see this
        </p>
        <p className="mt-3 font-sans text-sm leading-6 text-espresso/70">{message}</p>
        <a
          href={`/w/${encodeURIComponent(slug)}/edit#${section}`}
          className="mt-4 inline-flex min-h-11 items-center rounded-full border border-gold/40 px-5 font-sans text-xs uppercase tracking-[0.18em] text-espresso transition-colors hover:bg-gold/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          Open website editor
        </a>
      </div>
    </section>
  )
}

/** Paragraph text that preserves the author's line breaks without rendering HTML. */
export function Prose({ text, className = '' }: { text: string; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <p key={index} className="whitespace-pre-line text-pretty">
            {paragraph}
          </p>
        ))}
    </div>
  )
}

export function metadataString(item: PublicSiteItem, key: string): string {
  const value = item.metadata?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** An image source a guest page may render: an http(s) URL or a same-origin path. */
export function displayableImageSrc(value: string | null | undefined): string {
  if (!value) return ''
  if (value.startsWith('/') && !value.startsWith('//')) return value
  return isSafeHttpUrl(value) ? value : ''
}
