'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Camera,
  Upload,
  X,
  Check,
  Image as ImageIcon,
  Video,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { SectionEyebrow } from '@/components/wedding/section-eyebrow';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Moment = 'ceremony' | 'reception' | 'candid' | 'preparation' | 'group_photo';

interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  moment: Moment;
  error?: string;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
}

interface UploadResponse {
  success: boolean;
  media?: {
    id: string;
    url: string;
    caption?: string | null;
    moment?: string | null;
  };
  error?: string;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_IMAGE = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_VIDEO = new Set(['video/mp4', 'video/webm']);

const MOMENT_OPTIONS: { value: Moment; label: string }[] = [
  { value: 'ceremony', label: 'Ceremony' },
  { value: 'reception', label: 'Reception' },
  { value: 'candid', label: 'Candid' },
  { value: 'preparation', label: 'Preparation' },
  { value: 'group_photo', label: 'Group Photo' },
];

const EASING = [0.22, 1, 0.36, 1] as const;

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fileKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isWeddingDay(): boolean {
  const wedding = new Date('2026-12-23T00:00:00');
  return new Date() >= wedding;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export function MediaUpload() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' });
  const { toast } = useToast();

  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [defaultMoment, setDefaultMoment] = useState<Moment>('candid');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    // Defer time-based flag to avoid SSR mismatch.
    const t = setTimeout(() => setOpened(isWeddingDay()), 0);
    return () => clearTimeout(t);
  }, []);

  /* ─── File selection ─────────────────────────────────────────────────── */

  const validateFile = (file: File): string | undefined => {
    if (!ALLOWED_IMAGE.has(file.type) && !ALLOWED_VIDEO.has(file.type)) {
      return 'Unsupported file type.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File exceeds 10 MB limit.';
    }
    return undefined;
  };

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files);
      const next: QueuedFile[] = [];
      for (const file of incoming) {
        const error = validateFile(file);
        next.push({
          id: fileKey(),
          file,
          previewUrl: URL.createObjectURL(file),
          caption: '',
          moment: defaultMoment,
          error,
          status: error ? 'error' : 'queued',
          progress: 0,
        });
      }
      setQueue((prev) => [...prev, ...next]);
      setSubmitted(false);
    },
    [defaultMoment]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      addFiles(e.target.files);
    }
    // Reset so the same file can be selected again later
    e.target.value = '';
  };

  /* ─── Queue manipulation ─────────────────────────────────────────────── */

  const updateFile = (id: string, patch: Partial<QueuedFile>) => {
    setQueue((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeFile = (id: string) => {
    setQueue((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  /* ─── Upload ─────────────────────────────────────────────────────────── */

  const uploadOne = async (item: QueuedFile): Promise<boolean> => {
    updateFile(item.id, { status: 'uploading', progress: 5, error: undefined });

    const form = new FormData();
    form.append('file', item.file);
    form.append('caption', item.caption);
    form.append('moment', item.moment);

    try {
      // Simulated progress ticks while the request is in flight — gives
      // the user a sense that the upload is moving.
      const ticker = setInterval(() => {
        setQueue((prev) =>
          prev.map((f) =>
            f.id === item.id && f.status === 'uploading'
              ? { ...f, progress: Math.min(90, f.progress + 8) }
              : f
          )
        );
      }, 250);

      const res = await fetch('/api/media', { method: 'POST', body: form });
      clearInterval(ticker);

      const data: UploadResponse = await res.json();

      if (!res.ok || !data.success) {
        updateFile(item.id, {
          status: 'error',
          progress: 0,
          error: data.error ?? `Upload failed (${res.status})`,
        });
        return false;
      }

      updateFile(item.id, { status: 'done', progress: 100 });
      return true;
    } catch (err) {
      updateFile(item.id, {
        status: 'error',
        progress: 0,
        error: err instanceof Error ? err.message : 'Network error.',
      });
      return false;
    }
  };

  const handleUploadAll = async () => {
    const pending = queue.filter(
      (f) => f.status === 'queued' || f.status === 'error'
    );
    if (pending.length === 0) return;

    setSubmitting(true);
    let ok = 0;
    for (const item of pending) {
      // Re-validate before sending (cheap safety net)
      const err = validateFile(item.file);
      if (err) {
        updateFile(item.id, { status: 'error', error: err });
        continue;
      }
      const success = await uploadOne(item);
      if (success) ok += 1;
    }
    setSubmitting(false);

    if (ok === 0) {
      toast({
        title: 'Upload failed',
        description: 'Please check your files and try again.',
        variant: 'destructive',
      });
    } else {
      setSubmitted(true);
      toast({
        title: ok === 1 ? 'Photo shared!' : `${ok} photos shared!`,
        description: 'Thank you for adding to our memories.',
      });
      // Clear completed items after a short delay
      setTimeout(() => {
        setQueue((prev) => {
          prev.forEach((f) => {
            if (f.status === 'done') URL.revokeObjectURL(f.previewUrl);
          });
          return prev.filter((f) => f.status !== 'done');
        });
      }, 1500);
    }
  };

  /* ─── Reset to upload more ───────────────────────────────────────────── */

  const handleAddMore = () => {
    setSubmitted(false);
  };

  const readyCount = queue.filter(
    (f) => f.status === 'queued' || f.status === 'error'
  ).length;
  const allValid = queue.length > 0 && queue.every((f) => !f.error);

  /* ─── Render ─────────────────────────────────────────────────────────── */

  return (
    <section
      id="share"
     
      className="wewed-section bg-ivory py-20 md:py-32"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, ease: EASING }}
          className="mb-10 text-center md:mb-14"
        >
          <SectionEyebrow>Your Moments</SectionEyebrow>
          <div className="mb-4 flex items-center justify-center">
            <Camera className="h-5 w-5 text-gold" strokeWidth={1.25} />
          </div>
          <h2 className="wewed-heading wewed-heading-accent text-3xl font-light text-espresso sm:text-4xl md:text-5xl">
            Share Your Moments
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-sans text-sm leading-relaxed text-espresso/60 sm:text-base">
            Did you capture a beautiful moment? Share it with us and fellow
            guests.
          </p>
        </motion.div>

        {/* Pre-wedding notice (still allows upload for testing) */}
        {!opened && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, ease: EASING, delay: 0.1 }}
            className="mb-6 flex items-center justify-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-2 text-center"
          >
            <Sparkles className="size-3.5 text-gold" strokeWidth={1.5} />
            <span className="font-sans text-[11px] uppercase tracking-[0.18em] text-gold-muted">
              Photo sharing opens on December 23, 2026
            </span>
          </motion.div>
        )}

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7, ease: EASING, delay: 0.15 }}
        >
          <Card className="overflow-hidden border border-gold/30 bg-champagne shadow-sm">
            <CardContent className="p-5 sm:p-8">
              <AnimatePresence mode="wait">
                {submitted ? (
                  /* ─── Success state ─── */
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4, ease: EASING }}
                    className="flex flex-col items-center py-8 text-center"
                  >
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: 'spring',
                        stiffness: 240,
                        damping: 18,
                        delay: 0.05,
                      }}
                      className="flex size-16 items-center justify-center rounded-full border border-gold/40 bg-gold/10"
                    >
                      <Check className="size-7 text-gold" strokeWidth={2} />
                    </motion.span>
                    <h3 className="mt-5 wewed-heading text-2xl font-light text-espresso sm:text-3xl">
                      Thank you for sharing!
                    </h3>
                    <p className="mt-3 max-w-md font-sans text-sm text-espresso/65">
                      Your moments are now part of our forever. Every photo
                      helps us relive the magic of December 23, 2026.
                    </p>
                    <Button
                      onClick={handleAddMore}
                      variant="outline"
                      className="mt-7 border-gold/40 bg-transparent font-sans text-xs uppercase tracking-[0.15em] text-espresso hover:bg-gold hover:text-espresso"
                    >
                      <Camera className="mr-2 size-3.5" />
                      Share more photos
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="uploader"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* ─── Dropzone ─── */}
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      className={`group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all duration-300 sm:py-14 ${
                        dragActive
                          ? 'border-gold bg-gold/10'
                          : 'border-gold/40 bg-white/50 hover:border-gold hover:bg-gold/5'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                        multiple
                        onChange={handleFileInput}
                        className="sr-only"
                      />
                      <motion.span
                        whileHover={{ scale: 1.05 }}
                        className="flex size-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10 transition-colors duration-300 group-hover:bg-gold/15 sm:size-16"
                      >
                        <Camera
                          className="size-6 text-gold sm:size-7"
                          strokeWidth={1.25}
                        />
                      </motion.span>
                      <p className="mt-4 wewed-heading text-lg font-light text-espresso sm:text-xl">
                        Drag photos here or tap to browse
                      </p>
                      <p className="mt-2 font-sans text-[11px] uppercase tracking-[0.18em] text-espresso/45">
                        JPG · PNG · WEBP · GIF · MP4 · WEBM
                      </p>
                      <p className="mt-1 font-sans text-[11px] text-espresso/40">
                        Max 10 MB per file · Multiple files welcome
                      </p>
                    </div>

                    {/* ─── Default moment selector ─── */}
                    <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <label className="font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-espresso/55">
                        Default moment
                      </label>
                      <Select
                        value={defaultMoment}
                        onValueChange={(v) => setDefaultMoment(v as Moment)}
                      >
                        <SelectTrigger className="w-full border-gold/30 bg-white/70 font-sans text-sm text-espresso sm:w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MOMENT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* ─── Queue / previews ─── */}
                    <AnimatePresence>
                      {queue.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: EASING }}
                          className="mt-6 space-y-3 overflow-hidden"
                        >
                          {queue.map((item) => (
                            <QueueItem
                              key={item.id}
                              item={item}
                              onUpdate={updateFile}
                              onRemove={removeFile}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* ─── Submit ─── */}
                    <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                      <p className="order-2 font-sans text-[11px] text-espresso/45 sm:order-1">
                        {readyCount > 0
                          ? `${readyCount} photo${readyCount === 1 ? '' : 's'} ready to upload`
                          : 'Add photos to share with the couple'}
                      </p>
                      <Button
                        onClick={handleUploadAll}
                        disabled={
                          submitting ||
                          readyCount === 0 ||
                          (queue.length > 0 && !allValid && readyCount === 0)
                        }
                        className="order-1 w-full justify-center bg-gold font-sans text-xs uppercase tracking-[0.15em] text-espresso transition-all hover:bg-gold-light disabled:opacity-50 sm:order-2 sm:w-auto"
                      >
                        {submitting ? (
                          <>
                            <Upload className="mr-2 size-3.5 animate-pulse" />
                            Uploading…
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 size-3.5" />
                            Upload {readyCount > 0 ? `(${readyCount})` : ''}
                          </>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer monogram */}
        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="wewed-divider mx-auto w-32" />
          <p className="mt-6 wewed-monogram text-xs tracking-widest">
            C&amp;K &middot; 23.12.26
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Single queue row ─────────────────────────────────────────────────────── */

function QueueItem({
  item,
  onUpdate,
  onRemove,
}: {
  item: QueuedFile;
  onUpdate: (id: string, patch: Partial<QueuedFile>) => void;
  onRemove: (id: string) => void;
}) {
  const isImage = ALLOWED_IMAGE.has(item.file.type);
  const isVideo = ALLOWED_VIDEO.has(item.file.type);
  const Icon = isVideo ? Video : ImageIcon;
  const statusBadge = (() => {
    switch (item.status) {
      case 'uploading':
        return (
          <Badge className="border-gold/30 bg-gold/15 font-sans text-[10px] text-gold-muted">
            Uploading {item.progress}%
          </Badge>
        );
      case 'done':
        return (
          <Badge className="border-sage/30 bg-sage/15 font-sans text-[10px] text-sage">
            <Check className="size-3" />
            Shared
          </Badge>
        );
      case 'error':
        return (
          <Badge className="border-clay/30 bg-clay/15 font-sans text-[10px] text-clay">
            <AlertCircle className="size-3" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="border-espresso/20 bg-white/60 font-sans text-[10px] text-espresso/55"
          >
            Ready
          </Badge>
        );
    }
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: EASING }}
      className="rounded-xl border border-gold/20 bg-white/70 p-3"
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg border border-gold/20 bg-espresso sm:size-20">
          {isImage ? (
            <img
              src={item.previewUrl}
              alt={item.file.name}
              className="size-full object-cover"
            />
          ) : isVideo ? (
            <video
              src={item.previewUrl}
              className="size-full object-cover"
              muted
              preload="metadata"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Icon className="size-6 text-champagne/60" />
            </div>
          )}
          {item.status === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-espresso/40 backdrop-blur-[1px]">
              <span className="font-sans text-[10px] font-medium text-champagne">
                {item.progress}%
              </span>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="truncate font-sans text-xs text-espresso/70">
              {item.file.name}
            </span>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label="Remove file"
              className="flex size-6 items-center justify-center rounded-full text-espresso/40 transition-colors hover:bg-clay/10 hover:text-clay"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="mb-1 flex items-center gap-2">
            <span className="font-sans text-[10px] text-espresso/45">
              {formatBytes(item.file.size)}
            </span>
            {statusBadge}
          </div>
          <Input
            value={item.caption}
            onChange={(e) => onUpdate(item.id, { caption: e.target.value })}
            placeholder="Add a caption (optional)…"
            maxLength={120}
            disabled={item.status === 'uploading' || item.status === 'done'}
            className="h-8 border-gold/20 bg-white/60 font-sans text-xs placeholder:text-espresso/35 focus:border-gold focus:ring-gold/20"
          />
          <div className="mt-2">
            <Select
              value={item.moment}
              onValueChange={(v) => onUpdate(item.id, { moment: v as Moment })}
              disabled={item.status === 'uploading' || item.status === 'done'}
            >
              <SelectTrigger className="h-8 w-full border-gold/20 bg-white/60 font-sans text-xs sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {item.error && (
            <p className="mt-1.5 font-sans text-[11px] text-clay">
              {item.error}
            </p>
          )}
          {item.status === 'uploading' && (
            <Progress
              value={item.progress}
              className="mt-2 h-1 bg-gold/15 [&>[data-slot=progress-indicator]]:bg-gold"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
