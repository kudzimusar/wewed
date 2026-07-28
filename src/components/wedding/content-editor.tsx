'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Pencil,
  Save,
  Eye,
  Send,
  RotateCcw,
  X,
  Check,
  AlertCircle,
  FileText,
  History,
  Loader2,
  CalendarClock,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useWewedStore } from '@/lib/store'
import { isAdminLoggedIn } from '@/lib/admin-auth'
import { useToast } from '@/hooks/use-toast'

/* ============================================================
   ContentEditor
   ------------------------------------------------------------
   A floating pencil button that wraps any editable section of
   the public site. When an admin is logged in AND edit mode is
   ON, the pencil appears; clicking it opens a Dialog with:

     • Markdown editor (Textarea) + live Preview tab
     • Save as Draft button — creates a draft revision
     • Publish button — creates a published revision (live)
     • Revision history accordion — list previous revisions
       with restore buttons

   The editor is contextual: the parent passes section, fieldKey,
   label, currentValue, and weddingId. All API calls go to
   /api/content (POST) for create and /api/content?section=...
   for fetching history; restore calls POST /api/content/[id]/restore.

   Design language: espresso + champagne + gold accents, matches
   the rest of the wewed brand.
   ============================================================ */

interface ContentEditorProps {
  /** Section key — e.g. "our-story", "venue", "wedding" */
  section: string
  /** Field key — e.g. "title", "body", "venue" */
  fieldKey: string
  /** Human label shown in the dialog header */
  label: string
  /** The currently-rendered value (what the public sees now) */
  currentValue: string
  /** Wedding id (passes through to the API) */
  weddingId: string
  /** Optional: where the pencil button should align (default: top-right) */
  align?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

interface Revision {
  id: string
  section: string
  fieldKey: string
  value: string
  status: string
  previousValue: string | null
  weddingId: string
  authorId: string | null
  publishedAt: string | null
  scheduledFor: string | null
  createdAt: string
  updatedAt: string
}

const MAX_VALUE_BYTES = 256 * 1024

// Browser-safe byte length (TextEncoder works in modern browsers + Node 18+)
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
function byteLength(s: string): number {
  if (textEncoder) return textEncoder.encode(s).length
  // Fallback for very old environments
  return new Blob([s]).size
}

// ─── Helpers ─────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1) + '…'
}

// ─── Public component ────────────────────────────────────────

export function ContentEditor({
  section,
  fieldKey,
  label,
  currentValue,
  weddingId,
  align = 'top-right',
}: ContentEditorProps) {
  const editMode = useWewedStore((s) => s.editMode)
  const [mounted, setMounted] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client mount flag, no cascading render
    setMounted(true)
    setAdmin(isAdminLoggedIn())
    const onFocus = () => setAdmin(isAdminLoggedIn())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  // Don't render the pencil until we're sure the user is an admin
  // in edit mode. This keeps the public DOM clean for guests.
  if (!mounted || !admin || !editMode) return null

  const alignClass =
    align === 'top-right'
      ? 'top-1 right-1'
      : align === 'top-left'
      ? 'top-1 left-1'
      : align === 'bottom-right'
      ? 'bottom-1 right-1'
      : 'bottom-1 left-1'

  return (
    <>
      <motion.button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        aria-label={`Edit ${label}`}
        title={`Edit ${label}`}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={`absolute z-20 inline-flex size-8 items-center justify-center rounded-full border border-gold/40 bg-espresso/80 text-gold shadow-sm backdrop-blur-sm transition-colors hover:bg-gold hover:text-espresso ${alignClass}`}
      >
        <Pencil className="size-3.5" />
      </motion.button>
      <ContentEditorDialog
        open={open}
        onOpenChange={setOpen}
        section={section}
        fieldKey={fieldKey}
        label={label}
        currentValue={currentValue}
        weddingId={weddingId}
      />
    </>
  )
}

// ─── Dialog internals ────────────────────────────────────────

interface DialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  section: string
  fieldKey: string
  label: string
  currentValue: string
  weddingId: string
}

function ContentEditorDialog({
  open,
  onOpenChange,
  section,
  fieldKey,
  label,
  currentValue,
  weddingId,
}: DialogProps) {
  const { toast } = useToast()
  const [value, setValue] = useState(currentValue)
  const [revisions, setRevisions] = useState<Revision[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [tab, setTab] = useState<'edit' | 'preview' | 'history'>('edit')
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  // Sync the editor value when the dialog opens (or currentValue changes)
  useEffect(() => {
    if (open) {
      setValue(currentValue)
      setDirty(false)
      setError(null)
    }
  }, [open, currentValue])

  // Fetch revision history when the dialog opens
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const url = new URL('/api/content', window.location.origin)
      url.searchParams.set('section', section)
      url.searchParams.set('fieldKey', fieldKey)
      url.searchParams.set('weddingId', weddingId)
      url.searchParams.set('limit', '50')
      const res = await fetch(url.toString(), { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load history')
      const json = (await res.json()) as { success: boolean; data?: Revision[]; error?: string }
      if (!json.success) throw new Error(json.error ?? 'Failed to load history')
      setRevisions(json.data ?? [])
    } catch (err) {
      // Non-blocking — the editor still works without history
      console.warn('[ContentEditor] history fetch failed:', err)
      setRevisions([])
    } finally {
      setLoadingHistory(false)
    }
  }, [section, fieldKey, weddingId])

  useEffect(() => {
    if (open) void fetchHistory()
  }, [open, fetchHistory])

  // Track dirtiness
  useEffect(() => {
    setDirty(value !== currentValue)
  }, [value, currentValue])

  const publishNow = useMemo(() => saving === 'publish', [saving])
  const saveNow = useMemo(() => saving === 'draft', [saving])

  const createRevision = useCallback(
    async (status: 'draft' | 'published') => {
      setError(null)
      if (!value.trim()) {
        setError('Content cannot be empty.')
        return null
      }
      if (byteLength(value) > MAX_VALUE_BYTES) {
        setError(`Content too large (max ${MAX_VALUE_BYTES / 1024} KB).`)
        return null
      }
      setSaving(status === 'published' ? 'publish' : 'draft')
      try {
        const res = await fetch('/api/content', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section,
            fieldKey,
            value,
            status,
            weddingId,
          }),
        })
        const json = (await res.json()) as { success: boolean; data?: Revision; error?: string }
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? `Failed to save (${res.status})`)
        }
        toast({
          title: status === 'published' ? 'Published' : 'Saved as draft',
          description:
            status === 'published'
              ? `${label} is now live.`
              : `${label} draft saved. Publish when ready.`,
        })
        await fetchHistory()
        setDirty(false)
        if (status === 'published') {
          onOpenChange(false)
        }
        return json.data ?? null
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Save failed'
        setError(msg)
        toast({ title: 'Save failed', description: msg, variant: 'destructive' })
        return null
      } finally {
        setSaving(null)
      }
    },
    [value, section, fieldKey, weddingId, label, toast, fetchHistory, onOpenChange],
  )

  const handleSaveDraft = useCallback(() => void createRevision('draft'), [createRevision])
  const handlePublish = useCallback(() => void createRevision('published'), [createRevision])

  const handleRestore = useCallback(
    async (rev: Revision) => {
      setRestoringId(rev.id)
      try {
        const res = await fetch(`/api/content/${rev.id}/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'draft' }),
        })
        const json = (await res.json()) as { success: boolean; data?: Revision; error?: string }
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Restore failed')
        toast({
          title: 'Restored as draft',
          description: 'Review the content and publish when ready.',
        })
        // Load the restored value into the editor
        if (json.data) setValue(json.data.value)
        setTab('edit')
        await fetchHistory()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Restore failed'
        toast({ title: 'Restore failed', description: msg, variant: 'destructive' })
      } finally {
        setRestoringId(null)
      }
    },
    [fetchHistory, toast],
  )

  const handlePublishRestore = useCallback(
    async (rev: Revision) => {
      setRestoringId(rev.id)
      try {
        const res = await fetch(`/api/content/${rev.id}/restore`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'published' }),
        })
        const json = (await res.json()) as { success: boolean; data?: Revision; error?: string }
        if (!res.ok || !json.success) throw new Error(json.error ?? 'Restore failed')
        toast({
          title: 'Restored & published',
          description: 'The previous version is now live.',
        })
        if (json.data) setValue(json.data.value)
        await fetchHistory()
        onOpenChange(false)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Restore failed'
        toast({ title: 'Restore failed', description: msg, variant: 'destructive' })
      } finally {
        setRestoringId(null)
      }
    },
    [fetchHistory, toast, onOpenChange],
  )

  const publishedRevision = useMemo(
    () => revisions.find((r) => r.status === 'published') ?? null,
    [revisions],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden border-gold/30 bg-espresso p-0 text-champagne sm:max-w-3xl">
        <DialogHeader className="border-b border-gold/15 bg-espresso/80 px-6 py-4">
          <DialogTitle className="flex items-center gap-2 font-serif text-lg text-champagne">
            <Pencil className="size-4 text-gold" />
            <span>{label}</span>
            <Badge
              variant="outline"
              className="ml-1 border-gold/30 bg-gold/10 text-[10px] text-gold"
            >
              {section}.{fieldKey}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-[11px] text-champagne/50">
            Edit the content below. Save as a draft to come back to it later,
            or publish to make it live. Every version is preserved.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'edit' | 'preview' | 'history')}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="shrink-0 border-b border-gold/15 bg-espresso/60 px-4 pt-2">
            <TabsList className="h-auto gap-1 bg-transparent p-0">
              <TabsTrigger
                value="edit"
                className="gap-1.5 rounded-t-md border border-transparent px-3 py-2 font-sans text-xs text-champagne/60 transition-colors hover:text-champagne data-[state=active]:border-gold/30 data-[state=active]:bg-gold/10 data-[state=active]:text-gold"
              >
                <FileText className="size-3.5" /> Edit
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="gap-1.5 rounded-t-md border border-transparent px-3 py-2 font-sans text-xs text-champagne/60 transition-colors hover:text-champagne data-[state=active]:border-gold/30 data-[state=active]:bg-gold/10 data-[state=active]:text-gold"
              >
                <Eye className="size-3.5" /> Preview
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="gap-1.5 rounded-t-md border border-transparent px-3 py-2 font-sans text-xs text-champagne/60 transition-colors hover:text-champagne data-[state=active]:border-gold/30 data-[state=active]:bg-gold/10 data-[state=active]:text-gold"
              >
                <History className="size-3.5" /> History
                {revisions.length > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold/20 px-1 text-[9px] text-gold">
                    {revisions.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="wewed-scroll min-h-0 flex-1">
            <TabsContent value="edit" className="mt-0 p-4 sm:p-6">
              <div className="mb-2 flex items-center justify-between">
                <Label>Markdown content</Label>
                <span className="font-sans text-[10px] uppercase tracking-wider text-champagne/40">
                  {value.length.toLocaleString()} chars
                  {dirty && <span className="ml-2 text-gold">· unsaved</span>}
                </span>
              </div>
              <Textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={14}
                placeholder="Write your content in Markdown…"
                className="min-h-[280px] resize-y border-gold/30 bg-espresso/60 font-mono text-sm leading-relaxed text-champagne placeholder:text-champagne/30 focus-visible:ring-gold/40"
                autoFocus
              />
              <p className="mt-2 font-sans text-[11px] text-champagne/40">
                Tip: use <code className="rounded bg-champagne/10 px-1 text-gold">**bold**</code>,{' '}
                <code className="rounded bg-champagne/10 px-1 text-gold">*italic*</code>,{' '}
                <code className="rounded bg-champagne/10 px-1 text-gold">## headings</code>, and lists.
              </p>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-clay/30 bg-clay/10 p-3 text-clay-light">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <p className="font-sans text-xs">{error}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="preview" className="mt-0 p-4 sm:p-6">
              <PreviewPane value={value} label={label} />
            </TabsContent>

            <TabsContent value="history" className="mt-0 p-4 sm:p-6">
              {loadingHistory ? (
                <div className="flex items-center justify-center gap-2 py-12 text-champagne/50">
                  <Loader2 className="size-4 animate-spin text-gold" />
                  <span className="font-sans text-xs">Loading revision history…</span>
                </div>
              ) : revisions.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <History className="size-6 text-champagne/30" />
                  <p className="font-sans text-xs text-champagne/50">
                    No revisions yet. Save a draft or publish to start the history.
                  </p>
                </div>
              ) : (
                <RevisionHistory
                  revisions={revisions}
                  currentPublishedId={publishedRevision?.id}
                  onRestore={handleRestore}
                  onPublishRestore={handlePublishRestore}
                  restoringId={restoringId}
                />
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="shrink-0 border-t border-gold/15 bg-espresso/80 px-6 py-3">
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-champagne/50">
              {publishedRevision ? (
                <>
                  <Check className="size-3.5 text-sage-light" />
                  <span>
                    Live:{' '}
                    <span className="text-champagne/80">
                      {formatRelative(publishedRevision.createdAt)}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="size-3.5 text-gold" />
                  <span>No published version yet</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-champagne/60 hover:text-champagne"
              >
                <X className="size-3.5" /> Close
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!dirty || saveNow || publishNow}
                onClick={handleSaveDraft}
                className="border-gold/30 bg-transparent text-gold hover:bg-gold/10 disabled:opacity-40"
              >
                {saveNow ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save Draft
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={publishNow || saveNow}
                onClick={handlePublish}
                className="bg-gold text-espresso hover:bg-gold-light disabled:opacity-40"
              >
                {publishNow ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Publish
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub-components ──────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-gold-muted">
      {children}
    </span>
  )
}

function PreviewPane({ value, label }: { value: string; label: string }) {
  if (!value.trim()) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-champagne/40">
        <Eye className="size-6" />
        <p className="font-sans text-xs">Nothing to preview yet.</p>
      </div>
    )
  }
  return (
    <article className="prose prose-invert max-w-none rounded-lg border border-gold/15 bg-champagne/[0.03] p-6">
      <p className="wewed-monogram mb-3 text-[10px] tracking-[0.3em] text-gold/70">
        PREVIEW · {label}
      </p>
      <div className="wewed-prose">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="wewed-heading mb-3 mt-4 text-2xl text-champagne">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="wewed-heading mb-2 mt-4 text-xl text-champagne">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="wewed-heading mb-2 mt-3 text-lg text-gold">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="mb-3 font-sans text-sm leading-relaxed text-champagne/85">{children}</p>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-champagne">{children}</strong>
            ),
            em: ({ children }) => <em className="text-gold-light">{children}</em>,
            ul: ({ children }) => (
              <ul className="mb-3 ml-4 list-disc font-sans text-sm text-champagne/85">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="mb-3 ml-4 list-decimal font-sans text-sm text-champagne/85">{children}</ol>
            ),
            li: ({ children }) => <li className="mb-1">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="my-3 border-l-2 border-gold/40 pl-4 italic text-champagne/70">
                {children}
              </blockquote>
            ),
            a: ({ children, href }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold underline underline-offset-2 hover:text-gold-light"
              >
                {children}
              </a>
            ),
            code: ({ children }) => (
              <code className="rounded bg-champagne/10 px-1.5 py-0.5 font-mono text-[0.85em] text-gold">
                {children}
              </code>
            ),
            hr: () => <hr className="my-4 border-gold/20" />,
          }}
        >
          {value}
        </ReactMarkdown>
      </div>
    </article>
  )
}

interface HistoryProps {
  revisions: Revision[]
  currentPublishedId?: string
  onRestore: (r: Revision) => void
  onPublishRestore: (r: Revision) => void
  restoringId: string | null
}

function RevisionHistory({
  revisions,
  currentPublishedId,
  onRestore,
  onPublishRestore,
  restoringId,
}: HistoryProps) {
  if (revisions.length === 0) return null
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Label>Revision history ({revisions.length})</Label>
        <span className="font-sans text-[10px] text-champagne/40">
          Newest first · click a revision to expand
        </span>
      </div>
      <Accordion type="single" collapsible className="wewed-scroll max-h-[60vh] overflow-y-auto pr-1">
        {revisions.map((r) => (
          <AccordionItem
            key={r.id}
            value={r.id}
            className="rounded-md border border-gold/15 bg-espresso/40 px-3 mb-2"
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full flex-wrap items-center gap-2 pr-3">
                <StatusBadge status={r.status} />
                <span className="font-sans text-xs text-champagne/80">
                  {formatRelative(r.createdAt)}
                </span>
                <span className="font-sans text-[10px] text-champagne/40">
                  · {truncate(r.value.replace(/[#*`>_~\-]/g, '').trim(), 60)}
                </span>
                {r.id === currentPublishedId && (
                  <Badge
                    variant="outline"
                    className="ml-auto border-sage/40 bg-sage/10 text-[9px] text-sage-light"
                  >
                    LIVE
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="rounded-md border border-gold/10 bg-champagne/[0.03] p-3">
                <p className="mb-2 font-sans text-[10px] uppercase tracking-wider text-gold-muted">
                  Content
                </p>
                <pre className="wewed-scroll mb-3 max-h-40 overflow-auto whitespace-pre-wrap font-sans text-xs text-champagne/85">
                  {r.value}
                </pre>
                <div className="mb-3 grid grid-cols-1 gap-2 text-[10px] text-champagne/50 sm:grid-cols-3">
                  <div>
                    <span className="text-gold-muted">Created: </span>
                    {new Date(r.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="text-gold-muted">Published: </span>
                    {r.publishedAt ? new Date(r.publishedAt).toLocaleString() : '—'}
                  </div>
                  <div>
                    <span className="text-gold-muted">ID: </span>
                    <code className="text-gold/80">{r.id.slice(-8)}</code>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={restoringId === r.id}
                    onClick={() => onRestore(r)}
                    className="border-gold/30 bg-transparent text-gold hover:bg-gold/10"
                  >
                    {restoringId === r.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3" />
                    )}
                    Restore as draft
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={restoringId === r.id || r.id === currentPublishedId}
                    onClick={() => onPublishRestore(r)}
                    className="bg-gold text-espresso hover:bg-gold-light disabled:opacity-40"
                  >
                    <Send className="size-3" />
                    Restore & Publish
                  </Button>
                  {r.id === currentPublishedId && (
                    <span className="font-sans text-[10px] text-sage-light">
                      <Check className="mr-1 inline size-3" />
                      This is the live version
                    </span>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'border-gold/30 bg-gold/10 text-gold',
    pending: 'border-clay/30 bg-clay/10 text-clay-light',
    approved: 'border-sage/30 bg-sage/10 text-sage-light',
    scheduled: 'border-plum/30 bg-plum/10 text-plum-light',
    published: 'border-sage/40 bg-sage/15 text-sage-light',
    hidden: 'border-champagne/20 bg-champagne/10 text-champagne/60',
    rejected: 'border-clay/40 bg-clay/15 text-clay-light',
    archived: 'border-champagne/20 bg-champagne/5 text-champagne/50',
  }
  const icons: Record<string, React.ReactNode> = {
    draft: <Save className="size-2.5" />,
    pending: <CalendarClock className="size-2.5" />,
    published: <Check className="size-2.5" />,
    archived: <History className="size-2.5" />,
  }
  return (
    <Badge
      variant="outline"
      className={`gap-1 border px-1.5 py-0 text-[9px] uppercase tracking-wider ${styles[status] ?? styles.draft}`}
    >
      {icons[status]}
      {status}
    </Badge>
  )
}

/**
 * Optional: a hook for parent components to know whether the user is
 * currently in "edit mode" + admin (so they can position the editor
 * overlay correctly). Returns false during SSR and on first paint
 * to avoid hydration mismatches.
 */
export function useContentEditorVisible(): boolean {
  const editMode = useWewedStore((s) => s.editMode)
  const [mounted, setMounted] = useState(false)
  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot client mount flag
    setMounted(true)
    setAdmin(isAdminLoggedIn())
  }, [])
  return mounted && admin && editMode
}
