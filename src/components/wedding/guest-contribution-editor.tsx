'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart,
  Music,
  Save,
  Send,
  AlertCircle,
  Check,
  Edit3,
  Sparkles,
  Eye,
  Lock,
  Loader2,
  ArrowLeft,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

/* ============================================================
   GuestContributionEditor — token-gated, full-screen editor
   ------------------------------------------------------------
   Reads `?contribute=TOKEN` from the URL.
   Fetches any existing draft/submission from /api/contribute,
   and saves/submit via POST /api/contribute?token=TOKEN.

   Layout:
     - Header w/ monogram + couple name
     - Form fields (display name, relationship, type, message,
       favorite song, privacy)
     - Live word/char counter
     - Save Draft + Submit for Review buttons
     - Status states: draft / pending / approved / rejected /
       featured / hidden
   ============================================================ */

const MAX_WORDS = 500
const MAX_CHARS = 2500

type ContributionType = 'memory' | 'advice' | 'blessing' | 'funny_story' | 'wish'
type Privacy = 'public' | 'couple_only' | 'anonymous'
type Status =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'featured'
  | 'hidden'
  | 'none'

interface ContributionData {
  id: string
  type: ContributionType
  displayName: string
  relationship: string | null
  message: string
  photoUrl: string | null
  favoriteSong: string | null
  privacy: Privacy
  status: Status
  moderatorNotes: string | null
  wordCount: number
  charCount: number
  editCount: number
  submittedAt: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  canEdit: boolean
}

interface FetchResponse {
  guest: {
    id: string
    name: string
    email: string | null
    role: string
    side: string | null
  }
  wedding: {
    title: string
    partner1: string
    partner2: string
    date: string
  } | null
  contribution: ContributionData | null
}

const TYPE_LABELS: Record<ContributionType, string> = {
  memory: 'Memory',
  advice: 'Advice',
  blessing: 'Blessing',
  funny_story: 'Funny Story',
  wish: 'Wish',
}

const PRIVACY_LABELS: Record<Privacy, string> = {
  public: 'Public — show my name',
  couple_only: 'Couple Only — private to Charity & Kudzie',
  anonymous: 'Anonymous — hide my name',
}

function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

function exitEditor() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('contribute')
  window.history.pushState({}, '', url.toString())
  // hard reload so the public page re-renders
  window.location.href = url.pathname + (url.search ? url.search : '')
}

export function GuestContributionEditor() {
  const { toast } = useToast()
  const token = useMemo(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('contribute')
  }, [])

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FetchResponse | null>(null)

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [type, setType] = useState<ContributionType>('memory')
  const [message, setMessage] = useState('')
  const [favoriteSong, setFavoriteSong] = useState('')
  const [privacy, setPrivacy] = useState<Privacy>('public')
  const [saving, setSaving] = useState<'draft' | 'pending' | null>(null)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // ── Initial fetch ──
  const load = useCallback(async () => {
    if (!token) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/contribute?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
      })
      if (res.status === 404) {
        setNotFound(true)
        setLoading(false)
        return
      }
      if (!res.ok) {
        throw new Error(`Failed to load: ${res.status}`)
      }
      const json = (await res.json()) as { success?: boolean; data?: FetchResponse }
      const payload = json.data as FetchResponse
      setData(payload)
      // Pre-fill form
      setDisplayName(payload.contribution?.displayName ?? payload.guest.name)
      setRelationship(payload.contribution?.relationship ?? '')
      setType(payload.contribution?.type ?? 'memory')
      setMessage(payload.contribution?.message ?? '')
      setFavoriteSong(payload.contribution?.favoriteSong ?? '')
      setPrivacy(payload.contribution?.privacy ?? 'public')
      setIsEditing(!payload.contribution)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const wordCount = useMemo(() => countWords(message), [message])
  const charCount = message.length
  const overLimit = wordCount > MAX_WORDS || charCount > MAX_CHARS
  const nearLimit = wordCount > MAX_WORDS * 0.9 || charCount > MAX_CHARS * 0.9
  const canSubmit =
    displayName.trim().length > 0 &&
    message.trim().length > 0 &&
    !overLimit &&
    !saving

  const status: Status = data?.contribution?.status ?? 'none'
  const canEdit = data?.contribution?.canEdit ?? true

  // ── Save handler ──
  const handleSave = async (target: 'draft' | 'pending') => {
    if (!token) return
    if (target === 'pending' && !canSubmit) return
    setSaving(target)
    setError(null)
    try {
      const res = await fetch(`/api/contribute?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim(),
          relationship: relationship.trim() || undefined,
          type,
          message: message.trim(),
          favoriteSong: favoriteSong.trim() || undefined,
          privacy,
          status: target,
        }),
      })
      const json = (await res.json()) as {
        success?: boolean
        error?: string
        data?: ContributionData
      }
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? `Failed (${res.status})`)
      }
      // Refresh full state
      await load()
      if (target === 'pending') {
        setJustSubmitted(true)
        setIsEditing(false)
      }
      toast({
        title: target === 'draft' ? 'Draft saved' : 'Submitted for review',
        description:
          target === 'pending'
            ? 'Charity & Kudzie will see your message soon.'
            : 'You can come back and edit it any time.',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save'
      setError(msg)
      toast({
        title: 'Could not save',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }

  // ── Render states ──

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-champagne">
        <div className="flex flex-col items-center gap-3 text-espresso">
          <Loader2 className="size-8 animate-spin text-gold" />
          <p className="font-sans text-sm text-espresso/60">
            Loading your invitation…
          </p>
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-champagne px-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-clay/30 bg-white/80 shadow-lg backdrop-blur-sm">
            <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-full border border-clay/30 bg-clay/10">
                <AlertCircle className="size-7 text-clay" />
              </div>
              <h1 className="wewed-heading text-2xl text-espresso">
                Invalid or expired invitation link
              </h1>
              <p className="font-sans text-sm leading-relaxed text-espresso/60">
                The contribution link you followed is no longer valid. If you
                believe this is a mistake, please reach out to Charity &amp;
                Kudzie directly and they will send you a fresh link.
              </p>
              <Button
                onClick={exitEditor}
                variant="outline"
                className="mt-2 border-gold/30 bg-transparent text-espresso hover:bg-gold/10 hover:text-espresso"
              >
                <ArrowLeft className="size-4" />
                Back to the wedding site
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  // ── Main editor ──
  return (
    <div className="min-h-screen bg-champagne text-espresso">
      {/* Decorative top bar */}
      <div className="bg-gradient-to-r from-gold/15 via-gold/5 to-gold/15">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            onClick={exitEditor}
            className="inline-flex items-center gap-1.5 font-sans text-xs text-espresso/60 transition-colors hover:text-espresso"
          >
            <ArrowLeft className="size-3.5" />
            Back to site
          </button>
          <p className="wewed-monogram text-[10px] tracking-[0.3em] text-gold">
            C&amp;K · 23.12.26
          </p>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white/60 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 sm:py-14">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1">
              <Sparkles className="size-3 text-gold" />
              <span className="font-sans text-[10px] uppercase tracking-[0.2em] text-gold">
                A keepsake for the couple
              </span>
            </div>
            <h1 className="wewed-heading text-3xl text-espresso sm:text-4xl">
              Leave Your Message for{' '}
              <span className="text-clay">Charity &amp; Kudzie</span>{' '}
              <Heart className="inline size-6 fill-clay text-clay" />
            </h1>
            <p className="mx-auto mt-3 max-w-xl font-sans text-sm leading-relaxed text-espresso/60 sm:text-base">
              A memory, a blessing, a piece of advice, a wish for the journey
              ahead — whatever is on your heart, it will be treasured.
            </p>
          </motion.div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        {/* Status banner (when there's an existing contribution) */}
        <AnimatePresence mode="wait">
          {data?.contribution && !isEditing && !justSubmitted && (
            <motion.div
              key="status-banner"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <StatusBanner
                status={status}
                moderatorNotes={data.contribution.moderatorNotes}
                submittedAt={data.contribution.submittedAt}
                canEdit={canEdit}
                onEdit={() => setIsEditing(true)}
              />
            </motion.div>
          )}

          {justSubmitted && (
            <motion.div
              key="thank-you"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="mb-6 border-gold/30 bg-white/80 shadow-lg">
                <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 220 }}
                    className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/15"
                  >
                    <Check className="size-7 text-gold" />
                  </motion.div>
                  <h2 className="wewed-heading text-2xl text-espresso">
                    Thank you — your message is on its way.
                  </h2>
                  <p className="font-sans text-sm text-espresso/60">
                    Pending review by Charity &amp; Kudzie. Once approved, it
                    will appear in the village gallery for everyone to read.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <Badge className="border-gold/30 bg-gold/10 text-gold">
                      <Clock className="mr-1 size-3" />
                      Pending review
                    </Badge>
                    {canEdit && (
                      <Button
                        onClick={() => {
                          setJustSubmitted(false)
                          setIsEditing(true)
                        }}
                        variant="outline"
                        size="sm"
                        className="border-gold/30 bg-transparent text-espresso hover:bg-gold/10"
                      >
                        <Edit3 className="size-3.5" />
                        Edit message
                      </Button>
                    )}
                    <Button
                      onClick={exitEditor}
                      variant="outline"
                      size="sm"
                      className="border-espresso/20 bg-transparent text-espresso hover:bg-espresso/5"
                    >
                      <ArrowLeft className="size-3.5" />
                      Back to site
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editor form */}
        {(!data?.contribution || isEditing) && !justSubmitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="border-gold/30 bg-white/80 shadow-md backdrop-blur-sm">
              <CardContent className="space-y-5 p-6 sm:p-8">
                {/* Display name + relationship */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="display-name"
                      className="font-sans text-xs uppercase tracking-[0.18em] text-espresso/60"
                    >
                      Display name
                    </Label>
                    <Input
                      id="display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={80}
                      placeholder="Your name"
                      className="border-gold/30 bg-champagne/50 font-sans text-espresso placeholder:text-espresso/30 focus:border-gold focus:ring-gold/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="relationship"
                      className="font-sans text-xs uppercase tracking-[0.18em] text-espresso/60"
                    >
                      Relationship to couple
                    </Label>
                    <Input
                      id="relationship"
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      maxLength={120}
                      placeholder={"e.g. \"Charity's university friend\""}
                      className="border-gold/30 bg-champagne/50 font-sans text-espresso placeholder:text-espresso/30 focus:border-gold focus:ring-gold/20"
                    />
                  </div>
                </div>

                {/* Contribution type */}
                <div className="space-y-2">
                  <Label
                    htmlFor="type-select"
                    className="font-sans text-xs uppercase tracking-[0.18em] text-espresso/60"
                  >
                    Contribution type
                  </Label>
                  <Select
                    value={type}
                    onValueChange={(v) => setType(v as ContributionType)}
                  >
                    <SelectTrigger
                      id="type-select"
                      className="w-full border-gold/30 bg-champagne/50 font-sans text-espresso focus:border-gold focus:ring-gold/20"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABELS) as ContributionType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label
                      htmlFor="message"
                      className="font-sans text-xs uppercase tracking-[0.18em] text-espresso/60"
                    >
                      Your message
                    </Label>
                    <CounterPill
                      wordCount={wordCount}
                      charCount={charCount}
                      overLimit={overLimit}
                      nearLimit={nearLimit}
                    />
                  </div>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={9}
                    placeholder="Write from the heart — a memory, a blessing, a piece of advice, or a wish for the road ahead…"
                    className="resize-y border-gold/30 bg-champagne/50 font-serif text-base leading-relaxed text-espresso placeholder:font-sans placeholder:text-sm placeholder:text-espresso/30 focus:border-gold focus:ring-gold/20"
                  />
                  <div className="flex items-center justify-between font-sans text-[11px] text-espresso/50">
                    <span>
                      {wordCount.toLocaleString()} / {MAX_WORDS.toLocaleString()} words
                      {' · '}
                      {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
                    </span>
                    {overLimit && (
                      <span className="inline-flex items-center gap-1 text-clay">
                        <AlertCircle className="size-3" />
                        Over the limit
                      </span>
                    )}
                  </div>
                  {overLimit && (
                    <div className="rounded-md border border-clay/30 bg-clay/5 px-3 py-2 font-sans text-[11px] text-clay">
                      Please shorten your message to under {MAX_WORDS} words or{' '}
                      {MAX_CHARS.toLocaleString()} characters before submitting.
                    </div>
                  )}
                </div>

                {/* Favorite song */}
                <div className="space-y-2">
                  <Label
                    htmlFor="favorite-song"
                    className="font-sans text-xs uppercase tracking-[0.18em] text-espresso/60"
                  >
                    Favorite song <span className="text-espresso/30">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Music className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold/60" />
                    <Input
                      id="favorite-song"
                      value={favoriteSong}
                      onChange={(e) => setFavoriteSong(e.target.value)}
                      maxLength={140}
                      placeholder='e.g. "At Last — Etta James"'
                      className="border-gold/30 bg-champagne/50 pl-10 font-sans text-espresso placeholder:text-espresso/30 focus:border-gold focus:ring-gold/20"
                    />
                  </div>
                </div>

                {/* Privacy */}
                <div className="space-y-2">
                  <Label
                    htmlFor="privacy-select"
                    className="font-sans text-xs uppercase tracking-[0.18em] text-espresso/60"
                  >
                    Privacy
                  </Label>
                  <Select
                    value={privacy}
                    onValueChange={(v) => setPrivacy(v as Privacy)}
                  >
                    <SelectTrigger
                      id="privacy-select"
                      className="w-full border-gold/30 bg-champagne/50 font-sans text-espresso focus:border-gold focus:ring-gold/20"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIVACY_LABELS) as Privacy[]).map((p) => (
                        <SelectItem key={p} value={p}>
                          <span className="inline-flex items-center gap-2">
                            {p === 'public' && <Eye className="size-3.5 text-gold" />}
                            {p === 'couple_only' && <Lock className="size-3.5 text-plum" />}
                            {p === 'anonymous' && <Sparkles className="size-3.5 text-sage" />}
                            {PRIVACY_LABELS[p]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="font-sans text-[11px] text-espresso/50">
                    {privacy === 'public' &&
                      'Your name and message will appear in the public village gallery.'}
                    {privacy === 'couple_only' &&
                      'Only Charity & Kudzie will see this — it stays private to them.'}
                    {privacy === 'anonymous' &&
                      'Your message will appear publicly, but your name will be hidden as “Anonymous”.'}
                  </p>
                </div>

                {error && (
                  <div className="rounded-md border border-clay/30 bg-clay/5 px-3 py-2 font-sans text-xs text-clay">
                    {error}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-sans text-[11px] text-espresso/50">
                    {data?.contribution
                      ? `Last edited ${formatRelative(data.contribution.updatedAt)} · ${data.contribution.editCount} edit${data.contribution.editCount === 1 ? '' : 's'}`
                      : 'Your draft is auto-saved on your device until you submit.'}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={() => void handleSave('draft')}
                      disabled={!displayName.trim() || !message.trim() || saving !== null}
                      variant="outline"
                      className="border-gold/30 bg-transparent text-espresso hover:bg-gold/10 hover:text-espresso disabled:opacity-40"
                    >
                      {saving === 'draft' ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Save Draft
                    </Button>
                    <Button
                      onClick={() => void handleSave('pending')}
                      disabled={!canSubmit || saving !== null}
                      className="bg-clay text-champagne hover:bg-clay-light disabled:opacity-40"
                    >
                      {saving === 'pending' ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Submit for Review
                    </Button>
                  </div>
                </div>

                {isEditing && data?.contribution && (
                  <div className="flex justify-center border-t border-gold/15 pt-4">
                    <Button
                      onClick={() => {
                        setIsEditing(false)
                        // Restore from server state
                        const c = data.contribution
                        if (c) {
                          setDisplayName(c.displayName)
                          setRelationship(c.relationship ?? '')
                          setType(c.type)
                          setMessage(c.message)
                          setFavoriteSong(c.favoriteSong ?? '')
                          setPrivacy(c.privacy)
                        }
                      }}
                      variant="ghost"
                      size="sm"
                      className="font-sans text-xs text-espresso/60 hover:text-espresso"
                    >
                      Cancel editing
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Footer note */}
        <p className="mt-6 text-center font-sans text-[10px] text-espresso/40">
          wewed · Where love lives forever · Charity &amp; Kudzie · 23.12.26
        </p>
      </main>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CounterPill({
  wordCount,
  charCount,
  overLimit,
  nearLimit,
}: {
  wordCount: number
  charCount: number
  overLimit: boolean
  nearLimit: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-sans text-[10px] transition-colors ${
        overLimit
          ? 'border-clay/40 bg-clay/10 text-clay'
          : nearLimit
            ? 'border-gold/40 bg-gold/10 text-gold'
            : 'border-espresso/15 bg-espresso/5 text-espresso/50'
      }`}
    >
      {overLimit ? (
        <AlertCircle className="size-3" />
      ) : (
        <Check className="size-3" />
      )}
      {wordCount}/{MAX_WORDS} · {charCount.toLocaleString()}/{MAX_CHARS.toLocaleString()}
    </span>
  )
}

function StatusBanner({
  status,
  moderatorNotes,
  submittedAt,
  canEdit,
  onEdit,
}: {
  status: Status
  moderatorNotes: string | null
  submittedAt: string | null
  canEdit: boolean
  onEdit: () => void
}) {
  if (status === 'none' || status === 'draft') return null

  const config: Record<
    Exclude<Status, 'none' | 'draft'>,
    { title: string; body: string; tint: string; bg: string; border: string; icon: React.ReactNode }
  > = {
    pending: {
      title: 'Pending review',
      body: 'Your message is awaiting review by Charity & Kudzie. You can edit it any time before they approve it.',
      tint: 'text-gold',
      bg: 'bg-gold/10',
      border: 'border-gold/30',
      icon: <Clock className="size-5" />,
    },
    approved: {
      title: 'Approved & published',
      body: 'Your message is live in the village gallery. Thank you for being part of our story.',
      tint: 'text-sage',
      bg: 'bg-sage/10',
      border: 'border-sage/30',
      icon: <Check className="size-5" />,
    },
    featured: {
      title: 'Featured by the couple',
      body: 'Charity & Kudzie loved your message so much they marked it as a featured contribution.',
      tint: 'text-gold',
      bg: 'bg-gold/15',
      border: 'border-gold/40',
      icon: <Sparkles className="size-5" />,
    },
    rejected: {
      title: 'Needs revision',
      body: moderatorNotes ??
        'The couple has asked for some changes. Please edit your message and resubmit.',
      tint: 'text-clay',
      bg: 'bg-clay/10',
      border: 'border-clay/30',
      icon: <AlertCircle className="size-5" />,
    },
    hidden: {
      title: 'Hidden by the couple',
      body: 'This contribution has been hidden from the public gallery. Please contact the couple if you have questions.',
      tint: 'text-espresso/60',
      bg: 'bg-espresso/5',
      border: 'border-espresso/20',
      icon: <Lock className="size-5" />,
    },
  }

  const c = config[status as Exclude<Status, 'none' | 'draft'>]
  if (!c) return null

  return (
    <Card className={`mb-6 ${c.border} ${c.bg} backdrop-blur-sm`}>
      <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:gap-4 sm:p-6">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-full border ${c.border} ${c.bg} ${c.tint}`}
        >
          {c.icon}
        </div>
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h2 className={`wewed-heading text-lg ${c.tint}`}>{c.title}</h2>
            {submittedAt && (
              <span className="font-sans text-[10px] text-espresso/50">
                submitted {formatRelative(submittedAt)}
              </span>
            )}
          </div>
          <p className="font-sans text-sm leading-relaxed text-espresso/70">
            {c.body}
          </p>
          {status === 'rejected' && moderatorNotes && (
            <div className="mt-3 rounded-md border border-clay/20 bg-white/60 px-3 py-2">
              <p className="font-sans text-[10px] uppercase tracking-wider text-clay/80">
                Note from Charity &amp; Kudzie
              </p>
              <p className="mt-1 font-sans text-sm italic text-espresso/80">
                “{moderatorNotes}”
              </p>
            </div>
          )}
          {canEdit && status !== 'hidden' && (
            <Button
              onClick={onEdit}
              size="sm"
              variant="outline"
              className="mt-3 border-gold/30 bg-transparent text-espresso hover:bg-gold/10"
            >
              <Edit3 className="size-3.5" />
              {status === 'rejected' ? 'Edit & resubmit' : 'Edit message'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
