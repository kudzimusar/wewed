'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Camera,
  ZoomIn,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Heart,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionInfo } from '@/components/wedding/section-info';
import { useWeddingContextSafe } from '@/components/wedding/wedding-data-provider';
import {
  compactWeddingDate,
  coupleNames,
  formatWeddingDate,
} from '@/lib/wedding-template-defaults';

interface MediaItem {
  id: string;
  type: string;
  url: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
  moment?: string | null;
  isCurated?: boolean;
  isHero?: boolean;
  uploadedAt?: string | null;
}

type FilterKey =
  | 'all'
  | 'ceremony'
  | 'reception'
  | 'candid'
  | 'preparation'
  | 'group_photo'
  | 'videos';

interface FilterChip {
  key: FilterKey;
  label: string;
}

const PAGE_SIZE = 12;

const FILTERS: FilterChip[] = [
  { key: 'all', label: 'All' },
  { key: 'ceremony', label: 'Ceremony' },
  { key: 'reception', label: 'Reception' },
  { key: 'candid', label: 'Candid' },
  { key: 'preparation', label: 'Preparation' },
  { key: 'group_photo', label: 'Group Photos' },
  { key: 'videos', label: 'Videos' },
];

const MOMENT_LABELS: Record<string, string> = {
  ceremony: 'Ceremony',
  reception: 'Reception',
  candid: 'Candid',
  preparation: 'Preparation',
  group_photo: 'Group Photo',
};

const MOMENT_COLORS: Record<string, string> = {
  ceremony: 'border-gold/40 bg-gold/85 text-espresso',
  reception: 'border-plum/40 bg-plum/85 text-champagne',
  candid: 'border-clay/40 bg-clay/85 text-champagne',
  preparation: 'border-sage/40 bg-sage/85 text-champagne',
  group_photo: 'border-espresso/40 bg-espresso/85 text-champagne',
};

const EASING = [0.22, 1, 0.36, 1] as const;

const SPAN_HINTS = [
  'aspect-[3/4]',
  'aspect-square',
  'aspect-[4/5]',
  'aspect-[4/3]',
  'aspect-[3/4]',
  'aspect-[5/4]',
  'aspect-[3/4]',
  'aspect-square',
];

export function PhotoGallery() {
  const ctx = useWeddingContextSafe();
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });

  const [filter, setFilter] = useState<FilterKey>('all');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const names = coupleNames(ctx?.wedding);
  const compactDate = compactWeddingDate(ctx?.wedding?.date);
  const longDate = formatWeddingDate(ctx?.wedding?.date);
  const venue = ctx?.wedding?.venue || 'the wedding venue';
  const galleryHeading =
    ctx?.getContent('gallery', 'heading', 'Moments That Matter') ??
    'Moments That Matter';
  const gallerySubtitle =
    ctx?.getContent(
      'gallery',
      'subtitle',
      'Every glance, every laugh, every dance — preserved forever.',
    ) ?? 'Every glance, every laugh, every dance — preserved forever.';

  const editorialPreview = useMemo<MediaItem[]>(() => {
    if (!ctx) return [];
    const heroImage = ctx.getContent('hero', 'imageUrl', '');
    const familyImage = ctx.getContent('story', 'familyImageUrl', '');
    const configured = [
      ctx.getContent('gallery', 'previewImage0', ''),
      ctx.getContent('gallery', 'previewImage1', ''),
      ctx.getContent('gallery', 'previewImage2', ''),
      ctx.getContent('gallery', 'previewImage3', ''),
    ].filter(Boolean);

    const source = [...configured, heroImage, familyImage].filter(Boolean);
    if (source.length === 0) return [];

    const captions = [
      `A glimpse of ${names}' celebration`,
      `${names} — a favourite portrait`,
      `Details from ${venue}`,
      compactDate ? `${names} · ${compactDate}` : `${names} · wedding details`,
      `${venue} at golden hour`,
      'Forever begins',
    ];
    const moments = [
      'ceremony',
      'candid',
      'reception',
      'preparation',
      'reception',
      'candid',
    ];

    const desired = Math.min(6, Math.max(source.length, source.length >= 2 ? 6 : 3));
    return Array.from({ length: desired }, (_, index) => {
      const url = source[index % source.length];
      return {
        id: `editorial-preview-${index}`,
        type: 'photo',
        url,
        thumbnailUrl: url,
        caption: captions[index],
        moment: moments[index],
        isCurated: true,
        isHero: index === 0,
        uploadedAt: null,
      };
    });
  }, [ctx, names, compactDate, venue]);

  const fetchMedia = useCallback(async () => {
    if (!ctx?.slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/media?slug=${encodeURIComponent(ctx.slug)}`,
        { cache: 'no-store' },
      );
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: MediaItem[];
        error?: string;
      } | null;
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load gallery.');
      }

      const list = Array.isArray(data.data) ? [...data.data] : [];
      list.sort((a, b) => {
        if (Boolean(a.isHero) !== Boolean(b.isHero)) return b.isHero ? 1 : -1;
        const ta = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
        const tb = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
        return tb - ta;
      });
      setItems(list.length > 0 ? list : editorialPreview);
    } catch (caught) {
      if (editorialPreview.length > 0) {
        setItems(editorialPreview);
        setError(null);
      } else {
        setItems([]);
        setError(caught instanceof Error ? caught.message : 'Failed to load gallery.');
      }
    } finally {
      setLoading(false);
    }
  }, [ctx?.slug, editorialPreview]);

  useEffect(() => {
    void fetchMedia();
  }, [fetchMedia]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'videos') return items.filter((m) => m.type === 'video');
    return items.filter((m) => m.moment === filter);
  }, [items, filter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = filtered.length > visibleCount;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setLightboxIndex(null);
  }, [filter]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const showNext = useCallback(() => {
    setLightboxIndex((curr) => {
      if (curr === null || filtered.length === 0) return curr;
      return (curr + 1) % filtered.length;
    });
  }, [filtered.length]);

  const showPrev = useCallback(() => {
    setLightboxIndex((curr) => {
      if (curr === null || filtered.length === 0) return curr;
      return (curr - 1 + filtered.length) % filtered.length;
    });
  }, [filtered.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeLightbox();
      else if (event.key === 'ArrowRight') showNext();
      else if (event.key === 'ArrowLeft') showPrev();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [lightboxIndex, closeLightbox, showNext, showPrev]);

  const aspectFor = (index: number) => SPAN_HINTS[index % SPAN_HINTS.length];
  const footerMark = [ctx?.wedding?.monogram || names, compactDate]
    .filter(Boolean)
    .join(' · ');

  return (
    <section
      id="gallery"
      data-classic-section="gallery"
      className="wewed-section bg-champagne py-20 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: EASING }}
          className="mb-10 text-center md:mb-14"
        >
          <div className="mb-4 flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.25} />
            <span className="font-sans text-[11px] uppercase tracking-[0.25em] text-gold-muted">
              The Gallery
            </span>
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
            {galleryHeading}{' '}
            <SectionInfo text="Browse this wedding's photographs and films. Filter by moment type, open any image in the full-screen lightbox, and use the sharing section when guest contributions are enabled." />
          </h2>
          <p className="mx-auto mt-6 max-w-2xl font-sans text-sm leading-relaxed text-espresso/60 sm:text-base">
            {gallerySubtitle}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: EASING, delay: 0.15 }}
          className="mb-10 flex flex-wrap items-center justify-center gap-2"
        >
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-full border px-4 py-1.5 font-sans text-[11px] uppercase tracking-[0.15em] transition-all duration-300 ${
                  active
                    ? 'border-gold bg-gold text-espresso shadow-sm'
                    : 'border-gold/30 bg-white/60 text-espresso/65 hover:border-gold/60 hover:text-espresso'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </motion.div>

        {loading && items.length === 0 ? (
          <SkeletonGrid />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchMedia} />
        ) : filtered.length === 0 ? (
          <EmptyState names={names} date={longDate} />
        ) : (
          <>
            <div className="[column-fill:_balance] gap-4 sm:gap-5 [column-count:1] sm:[column-count:2] lg:[column-count:3] xl:[column-count:4]">
              {visible.map((item, index) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  index={index}
                  aspectClass={aspectFor(index)}
                  onOpen={() => setLightboxIndex(index)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-12 flex justify-center">
                <Button
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  variant="outline"
                  className="border-gold/40 bg-transparent font-sans text-xs uppercase tracking-[0.15em] text-espresso hover:bg-gold hover:text-espresso"
                >
                  Load More
                  <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold-muted">
                    +{Math.min(PAGE_SIZE, filtered.length - visibleCount)}
                  </span>
                </Button>
              </div>
            )}
          </>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: EASING }}
          className="mt-16 text-center"
        >
          <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-gold/25 bg-ivory/70 p-6 sm:p-8">
            <span className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
              <Camera className="size-5 text-gold" strokeWidth={1.25} />
            </span>
            <p className="wewed-heading text-xl font-light text-espresso sm:text-2xl">
              Were you there? Share your lens.
            </p>
            <p className="max-w-md font-sans text-sm leading-relaxed text-espresso/60">
              Every photo adds to {names}&apos; story. When sharing is open,
              guest uploads stay attached to this wedding and can become part of
              the curated collection.
            </p>
            <Button
              asChild
              className="bg-gold font-sans text-xs uppercase tracking-[0.15em] text-espresso hover:bg-gold-light"
            >
              <a href="#share">
                <Camera className="mr-2 size-3.5" />
                Share Your Photos
              </a>
            </Button>
          </div>
        </motion.div>

        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider mx-auto w-32" />
          {footerMark && (
            <p className="mt-6 wewed-monogram text-xs tracking-widest">
              {footerMark}
            </p>
          )}
        </motion.div>
      </div>

      <Lightbox
        items={filtered}
        index={lightboxIndex}
        onClose={closeLightbox}
        onNext={showNext}
        onPrev={showPrev}
      />
    </section>
  );
}

function GalleryCard({
  item,
  index,
  aspectClass,
  onOpen,
}: {
  item: MediaItem;
  index: number;
  aspectClass: string;
  onOpen: () => void;
}) {
  const isVideo = item.type === 'video';
  const thumb = item.thumbnailUrl || item.url;
  const momentLabel = item.moment
    ? MOMENT_LABELS[item.moment] ?? item.moment
    : null;
  const momentColor = item.moment
    ? MOMENT_COLORS[item.moment] ?? 'border-gold/40 bg-gold/85 text-espresso'
    : 'border-gold/40 bg-gold/85 text-espresso';

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{
        duration: 0.5,
        ease: EASING,
        delay: Math.min((index % 8) * 0.05, 0.4),
      }}
      className="wewed-photo-frame group relative mb-4 block w-full overflow-hidden rounded-xl border border-gold/15 bg-espresso shadow-sm sm:mb-5"
      aria-label={item.caption ? `Open photo: ${item.caption}` : 'Open photo'}
    >
      <div className={`relative w-full overflow-hidden ${aspectClass}`}>
        {isVideo ? (
          <video
            src={item.url}
            muted
            preload="metadata"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        ) : (
          <img
            src={thumb}
            alt={item.caption ?? 'Wedding photo'}
            loading="lazy"
            className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-espresso/30 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <span className="absolute right-3 top-3 flex size-9 scale-90 items-center justify-center rounded-full border border-champagne/30 bg-espresso/40 text-champagne opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
          <ZoomIn className="size-4" strokeWidth={1.5} />
        </span>

        {isVideo && (
          <span className="absolute left-3 top-3 flex size-9 items-center justify-center rounded-full border border-champagne/30 bg-espresso/50 text-champagne backdrop-blur-sm">
            <span className="ml-0.5 block size-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-champagne" />
          </span>
        )}

        {momentLabel && (
          <span
            className={`absolute bottom-3 left-3 rounded-full border px-2.5 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] backdrop-blur-sm ${momentColor}`}
          >
            {momentLabel}
          </span>
        )}

        {item.caption && (
          <div className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-espresso/90 via-espresso/60 to-transparent p-4 pt-8 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <p className="line-clamp-3 font-serif text-sm italic leading-snug text-champagne">
              &ldquo;{item.caption}&rdquo;
            </p>
          </div>
        )}

        {item.isCurated && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-plum/40 bg-plum/85 px-2 py-0.5 font-sans text-[9px] uppercase tracking-[0.12em] text-champagne opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <Heart className="size-2.5 fill-current" />
            Curated
          </span>
        )}
      </div>
    </motion.button>
  );
}

function Lightbox({
  items,
  index,
  onClose,
  onNext,
  onPrev,
}: {
  items: MediaItem[];
  index: number | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const isOpen = index !== null && index >= 0 && index < items.length;
  const current = isOpen && index !== null ? items[index] : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[95vw] border-none bg-espresso/95 p-0 backdrop-blur-md sm:max-w-[90vw] [&>button]:hidden"
      >
        <DialogTitle className="sr-only">
          {current?.caption ?? 'Photo viewer'}
        </DialogTitle>

        <div className="relative flex min-h-[60vh] flex-col items-center justify-center p-3 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-20 flex size-10 items-center justify-center rounded-full border border-champagne/30 bg-espresso/60 text-champagne transition-all hover:bg-clay hover:text-champagne"
          >
            <X className="size-5" />
          </button>

          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-champagne/30 bg-espresso/60 text-champagne transition-all hover:bg-gold hover:text-espresso sm:left-4 sm:size-12"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-champagne/30 bg-espresso/60 text-champagne transition-all hover:bg-gold hover:text-espresso sm:right-4 sm:size-12"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}

          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={current.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.25, ease: EASING }}
                className="flex max-h-[78vh] w-full flex-col items-center justify-center"
              >
                {current.type === 'video' ? (
                  <video
                    src={current.url}
                    controls
                    className="max-h-[68vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
                  />
                ) : (
                  <img
                    src={current.url}
                    alt={current.caption ?? 'Wedding photo'}
                    className="max-h-[68vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {current && (
            <div className="mt-4 flex w-full max-w-2xl flex-col items-center gap-2 text-center">
              {current.moment && (
                <Badge
                  variant="outline"
                  className="border-gold/40 bg-espresso/40 font-sans text-[10px] uppercase tracking-[0.15em] text-gold-light"
                >
                  {MOMENT_LABELS[current.moment] ?? current.moment}
                </Badge>
              )}
              {current.caption && (
                <p className="font-serif text-base italic leading-relaxed text-champagne/90 sm:text-lg">
                  &ldquo;{current.caption}&rdquo;
                </p>
              )}
              {items.length > 1 && (
                <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-champagne/45">
                  {(index ?? 0) + 1} of {items.length}
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SkeletonGrid() {
  return (
    <div className="[column-count:1] gap-4 sm:[column-count:2] sm:gap-5 lg:[column-count:3] xl:[column-count:4]">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="mb-4 sm:mb-5">
          <Skeleton
            className={`w-full rounded-xl border border-gold/15 ${
              SPAN_HINTS[index % SPAN_HINTS.length]
            }`}
          />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ names, date }: { names: string; date: string }) {
  return (
    <Card className="border-gold/20 bg-ivory/60">
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center sm:py-20">
        <span className="flex size-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
          <Camera className="size-6 text-gold" strokeWidth={1.25} />
        </span>
        <h3 className="mt-5 wewed-heading text-xl font-light text-espresso sm:text-2xl">
          The gallery is waiting for its first memory
        </h3>
        <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-espresso/55">
          {date
            ? `Photos for ${names} can be shared here around ${date}.`
            : `Photos for ${names} will appear here as the celebration unfolds.`}{' '}
          Every published item remains scoped to this wedding.
        </p>
        <Button
          asChild
          className="mt-6 bg-gold font-sans text-xs uppercase tracking-[0.15em] text-espresso hover:bg-gold-light"
        >
          <a href="#share">
            <Camera className="mr-2 size-3.5" />
            Share a photo
          </a>
        </Button>
      </div>
    </Card>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-clay/30 bg-ivory/60">
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full border border-clay/30 bg-clay/10">
          <Loader2 className="size-5 text-clay" />
        </span>
        <h3 className="mt-5 wewed-heading text-xl font-light text-espresso">
          Couldn&rsquo;t load the gallery
        </h3>
        <p className="mt-2 max-w-md font-sans text-sm text-espresso/55">
          {message}
        </p>
        <Button
          onClick={onRetry}
          variant="outline"
          className="mt-6 border-gold/40 bg-transparent font-sans text-xs uppercase tracking-[0.15em] text-espresso hover:bg-gold hover:text-espresso"
        >
          Try again
        </Button>
      </div>
    </Card>
  );
}
