'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useWeddingContext } from '@/components/wedding/wedding-data-provider'
import {
  OwnerSetupPrompt,
  SiteSection,
  displayableImageSrc,
  usePublishedCopy,
} from '@/components/wedding/site/primitives'

type GalleryPhoto = { id: string; url: string; thumbnailUrl: string | null; caption: string | null }

/**
 * Real MediaItem photos only, filtered by the server's media governance for this viewer. While the
 * request is in flight nothing is drawn; an empty wedding gallery is hidden from guests.
 */
export function SiteGallery() {
  const { slug } = useWeddingContext()
  const heading = usePublishedCopy('gallery', 'heading')
  const subtitle = usePublishedCopy('gallery', 'subtitle')
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null)
  const [active, setActive] = useState<GalleryPhoto | null>(null)

  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    fetch(`/api/media?slug=${encodeURIComponent(slug)}&type=photo&limit=24`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { data?: GalleryPhoto[] } | null) => {
        const rows = Array.isArray(payload?.data) ? payload.data : []
        setPhotos(rows.filter((row) => displayableImageSrc(row.url)))
      })
      .catch((error: unknown) => {
        if ((error as { name?: string })?.name !== 'AbortError') setPhotos([])
      })
    return () => controller.abort()
  }, [slug])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  if (photos === null) return null
  if (!photos.length) {
    return <OwnerSetupPrompt section="gallery" message="No photos are in the gallery yet, so guests don't see it." />
  }

  return (
    <SiteSection id="gallery" eyebrow="Gallery" heading={heading || 'Moments'} subtitle={subtitle || undefined} tone="espresso">
      <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4" data-testid="site-gallery">
        {photos.map((photo) => {
          const src = displayableImageSrc(photo.thumbnailUrl) || photo.url
          return (
            <li key={photo.id} className="mb-3 break-inside-avoid sm:mb-4">
              <button
                type="button"
                onClick={() => setActive(photo)}
                className="group relative block w-full overflow-hidden rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                aria-label={photo.caption ? `Open photo: ${photo.caption}` : 'Open photo'}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- governed media hosts vary; intrinsic size keeps the masonry layout */}
                <img src={src} alt={photo.caption ?? ''} loading="lazy" decoding="async" className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
              </button>
            </li>
          )
        })}
      </ul>
      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.caption ?? 'Photo'}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setActive(null)}
        >
          <div className="relative h-full max-h-[85vh] w-full max-w-5xl">
            <Image src={active.url} alt={active.caption ?? ''} fill sizes="100vw" unoptimized className="object-contain" />
          </div>
          {active.caption ? (
            <p className="absolute inset-x-0 bottom-6 px-6 text-center font-serif text-base italic text-champagne">{active.caption}</p>
          ) : null}
          <button
            type="button"
            autoFocus
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/10 text-champagne hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
            aria-label="Close photo"
          >
            ✕
          </button>
        </div>
      ) : null}
    </SiteSection>
  )
}
