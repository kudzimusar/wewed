'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Users,
  Music,
  MessageSquare,
  Play,
  X,
  LogOut,
  Search,
  Download,
  Check,
  Clock,
  Heart,
  Disc3,
  Sparkles,
  Lock,
  Unlock,
  CheckCircle2,
  XCircle,
  ChevronUp,
  ChevronDown,
  Send,
  CalendarDays,
  TrendingUp,
  UserCheck,
  Baby,
  Wifi,
  WifiOff,
  SkipForward,
  PlayCircle,
  PartyPopper,
  Megaphone,
  Inbox,
  Trash2,
  Star,
  Eye,
  Copy,
  Link as LinkIcon,
  Save,
  AlertCircle,
  Mail,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useWewedLive } from '@/lib/useWewedLive'
import {
  verifyAdmin,
  isAdminLoggedIn,
  setAdminLoggedIn,
  logoutAdmin,
  adminSessionRemainingMs,
  ADMIN_SESSION_TTL_MS,
} from '@/lib/admin-auth'
import { useToast } from '@/hooks/use-toast'

/* ============================================================
   Admin Dashboard — Couple control center
   ------------------------------------------------------------
   Opens as a full-screen Dialog overlay. Five tabs cover the
   couple's whole wedding-day workflow: overview, RSVPs, songs,
   messages/capsule, and live ceremony control.

   Auth: lightweight client password gate (see admin-auth.ts).
   Polling: every 10s while open + authed.
   Real-time: socket.io via useWewedLive for ceremony + check-ins.
   ============================================================ */

const WEDDING_DATE = new Date('2026-12-23T13:00:00+02:00')
const POLL_INTERVAL_MS = 10_000

// ─── Types ──────────────────────────────────────────────────────────────────

interface GuestSummary {
  id: string
  name: string
  email: string | null
  role: string
  side: string | null
}

interface RSVPRow {
  id: string
  token: string
  attending: boolean | null
  mealChoice: string | null
  plusOne: boolean
  plusOneName: string | null
  plusOneMeal: string | null
  kidsAttending: boolean
  kidsCount: number
  songRequests: string | null
  dietaryNotes: string | null
  message: string | null
  checkedIn: boolean
  checkedInAt: string | null
  createdAt: string
  updatedAt: string
  guest: GuestSummary
}

interface SongRow {
  id: string
  title: string
  artist: string
  phase: string
  moment: string | null
  order: number
  votes: number
  playedAt?: string | null
  notes?: string | null
}

interface MessageRow {
  id: string
  type: string
  content: string
  authorName: string
  authorToken: string | null
  isPublic: boolean
  createdAt: string
}

interface ContribGuest {
  id: string
  name: string
  email: string | null
  role: string
  side: string | null
  contributionToken: string | null
}

interface ContributionRow {
  id: string
  type: string
  displayName: string
  relationship: string | null
  message: string
  photoUrl: string | null
  favoriteSong: string | null
  privacy: string
  status: string
  moderatorNotes: string | null
  wordCount: number
  charCount: number
  editCount: number
  submittedAt: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
  updatedAt: string
  guest: ContribGuest
}

interface GeneratedToken {
  guestId: string
  name: string
  email: string | null
  role: string
  side: string | null
  token: string
  url: string
}

type ContribFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'featured' | 'hidden' | 'draft'

interface ProgrammeItem {
  id: string
  time: string
  title: string
  description: string | null
  icon: string | null
  order: number
}

interface WeddingData {
  id: string
  title: string
  monogram: string | null
  tagline: string | null
  date: string
  venue: string
  venueCity: string
  venueCountry: string
  lifecycle: string
  programme: ProgrammeItem[]
}

interface AdminDashboardProps {
  onClose: () => void
}

// ─── Fetch helper ───────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as { success?: boolean; data?: T; error?: string } & T
  // APIs return either { success, data } or the raw shape
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T
  }
  return json as T
}

// ─── Time helpers ───────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function daysUntilWedding(): number {
  const diff = WEDDING_DATE.getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / 86_400_000))
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatSessionRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

// ─── Main component ─────────────────────────────────────────────────────────

export function AdminDashboard({ onClose }: AdminDashboardProps) {
  const live = useWewedLive()
  const { toast } = useToast()

  const [authed, setAuthed] = useState<boolean>(false)
  const [authChecked, setAuthChecked] = useState<boolean>(false)
  const [sessionMs, setSessionMs] = useState<number>(0)

  // Data
  const [rsvps, setRsvps] = useState<RSVPRow[]>([])
  const [songs, setSongs] = useState<SongRow[]>([])
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [contributions, setContributions] = useState<ContributionRow[]>([])
  const [wedding, setWedding] = useState<WeddingData | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

  // Local-only played-songs (no API for this yet — persist in localStorage)
  const [playedSongs, setPlayedSongs] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem('wewed:played-songs')
      return raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch {
      return {}
    }
  })

  // Local-only hidden messages (approve/hide workflow)
  const [hiddenMessages, setHiddenMessages] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem('wewed:hidden-messages')
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })

  // ── Initial auth check (client-only) ──
  useEffect(() => {
    setAuthed(isAdminLoggedIn())
    setAuthChecked(true)
  }, [])

  // ── Session expiry ticker ──
  useEffect(() => {
    if (!authed) return
    const tick = () => setSessionMs(adminSessionRemainingMs())
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [authed])

  // ── Persist local maps ──
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('wewed:played-songs', JSON.stringify(playedSongs))
    } catch {
      /* ignore */
    }
  }, [playedSongs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('wewed:hidden-messages', JSON.stringify(hiddenMessages))
    } catch {
      /* ignore */
    }
  }, [hiddenMessages])

  // ── Data refresh ──
  const refresh = useCallback(async () => {
    const controller = new AbortController()
    setLoading(true)
    try {
      const [r, s, m, w, c] = await Promise.allSettled([
        fetchJson<{ data: RSVPRow[] } | RSVPRow[]>('/api/rsvp', controller.signal),
        fetchJson<{ data: SongRow[] } | SongRow[]>('/api/songs', controller.signal),
        fetchJson<{ data: MessageRow[] } | MessageRow[]>('/api/messages', controller.signal),
        fetchJson<WeddingData>('/api/wedding', controller.signal),
        fetchJson<{ data: ContributionRow[] } | ContributionRow[]>('/api/contributions', controller.signal),
      ])

      if (r.status === 'fulfilled') {
        const val = r.value as { data?: RSVPRow[] } | RSVPRow[]
        setRsvps(Array.isArray(val) ? val : val.data ?? [])
      }
      if (s.status === 'fulfilled') {
        const val = s.value as { data?: SongRow[] } | SongRow[]
        setSongs(Array.isArray(val) ? val : val.data ?? [])
      }
      if (m.status === 'fulfilled') {
        const val = m.value as { data?: MessageRow[] } | MessageRow[]
        setMessages(Array.isArray(val) ? val : val.data ?? [])
      }
      if (w.status === 'fulfilled') {
        setWedding(w.value as WeddingData)
      }
      if (c.status === 'fulfilled') {
        const val = c.value as { data?: ContributionRow[] } | ContributionRow[]
        setContributions(Array.isArray(val) ? val : val.data ?? [])
      }
      setLastUpdated(new Date())
    } catch {
      /* individual rejections handled above */
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Polling ──
  useEffect(() => {
    if (!authed) return
    void refresh()
    const id = window.setInterval(() => void refresh(), POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [authed, refresh])

  // ── Auth handlers ──
  const handleLogin = (password: string): boolean => {
    if (verifyAdmin(password)) {
      setAdminLoggedIn()
      setAuthed(true)
      setSessionMs(ADMIN_SESSION_TTL_MS)
      toast({
        title: 'Welcome back, Charity & Kudzie',
        description: 'You are signed in to the couple dashboard.',
      })
      return true
    }
    toast({
      title: 'Incorrect password',
      description: 'Please try again. The default is wewed-admin-2026.',
      variant: 'destructive',
    })
    return false
  }

  const handleLogout = () => {
    logoutAdmin()
    setAuthed(false)
    toast({ title: 'Signed out', description: 'Admin session ended.' })
  }

  // ── Identfy as couple to socket (for ceremony broadcasts) ──
  useEffect(() => {
    if (authed && live.isConnected) {
      live.identify('Charity & Kudzie', { isCouple: true })
    }
  }, [authed, live.isConnected, live])

  // ── Body scroll lock when dashboard is open ──
  useEffect(() => {
    if (typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // ── Escape to close (in addition to Dialog's built-in) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Derived stats ──
  const stats = useMemo(() => {
    const total = rsvps.length
    const accepted = rsvps.filter((r) => r.attending === true)
    const declined = rsvps.filter((r) => r.attending === false)
    const pending = rsvps.filter((r) => r.attending === null)
    const headCount = accepted.reduce(
      (acc, r) => acc + 1 + (r.plusOne ? 1 : 0) + (r.kidsAttending ? r.kidsCount : 0),
      0
    )
    const plusOnes = accepted.filter((r) => r.plusOne).length
    const kidsTotal = accepted
      .filter((r) => r.kidsAttending)
      .reduce((acc, r) => acc + r.kidsCount, 0)
    const checkedIn = rsvps.filter((r) => r.checkedIn).length
    return {
      total,
      acceptedCount: accepted.length,
      headCount,
      declined: declined.length,
      pending: pending.length,
      plusOnes,
      kidsTotal,
      checkedIn,
    }
  }, [rsvps])

  // ── Recent activity feed ──
  type ActivityItem = {
    id: string
    kind: 'rsvp' | 'message' | 'song'
    label: string
    detail: string
    at: string
  }
  const activity = useMemo<ActivityItem[]>(() => {
    const rsvpItems: ActivityItem[] = rsvps.slice(0, 10).map((r) => ({
      id: `rsvp-${r.id}`,
      kind: 'rsvp' as const,
      label: r.guest?.name ?? 'Unknown guest',
      detail:
        r.attending === true
          ? `Accepted · ${r.mealChoice ?? 'no meal'}${r.plusOne ? ' · +1' : ''}`
          : r.attending === false
            ? 'Declined'
            : 'Pending response',
      at: r.createdAt,
    }))
    const msgItems: ActivityItem[] = messages.slice(0, 10).map((m) => ({
      id: `msg-${m.id}`,
      kind: 'message' as const,
      label: m.authorName,
      detail: m.content.slice(0, 80) + (m.content.length > 80 ? '…' : ''),
      at: m.createdAt,
    }))
    return [...rsvpItems, ...msgItems]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 12)
  }, [rsvps, messages])

  // ── Mutations ──
  const handleToggleCheckIn = useCallback(
    async (token: string) => {
      // Optimistic update
      setRsvps((prev) =>
        prev.map((r) =>
          r.token === token
            ? {
                ...r,
                checkedIn: !r.checkedIn,
                checkedInAt: !r.checkedIn ? new Date().toISOString() : null,
              }
            : r
        )
      )
      try {
        const res = await fetch(`/api/rsvp/${token}`, { method: 'PATCH' })
        if (!res.ok) throw new Error('Failed')
        const json = (await res.json()) as { checkedIn: boolean; data: RSVPRow }
        setRsvps((prev) =>
          prev.map((r) =>
            r.token === token
              ? {
                  ...r,
                  checkedIn: json.checkedIn,
                  checkedInAt: json.data.checkedInAt,
                }
              : r
          )
        )
        toast({
          title: json.checkedIn ? 'Guest checked in' : 'Check-in reverted',
          description: json.data.guest?.name,
        })
      } catch {
        // Revert on failure
        setRsvps((prev) =>
          prev.map((r) =>
            r.token === token
              ? { ...r, checkedIn: !r.checkedIn, checkedInAt: null }
              : r
          )
        )
        toast({
          title: 'Check-in failed',
          description: 'Please try again.',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

  const handleMarkSongPlayed = useCallback(
    (songId: string) => {
      setPlayedSongs((prev) => {
        if (prev[songId]) {
          // Unmark
          const next = { ...prev }
          delete next[songId]
          return next
        }
        return { ...prev, [songId]: new Date().toISOString() }
      })
    },
    []
  )

  const handleMoveSong = useCallback((songId: string, dir: -1 | 1) => {
    setSongs((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order || b.votes - a.votes)
      const idx = sorted.findIndex((s) => s.id === songId)
      if (idx < 0) return prev
      const swapWith = idx + dir
      if (swapWith < 0 || swapWith >= sorted.length) return prev
      const a = sorted[idx]
      const b = sorted[swapWith]
      const aOrder = a.order
      a.order = b.order
      b.order = aOrder
      return [...sorted]
    })
  }, [])

  const handleAddSong = useCallback(
    async (title: string, artist: string, phase: string) => {
      try {
        const res = await fetch('/api/songs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, artist, phase }),
        })
        if (!res.ok) throw new Error('Failed')
        const json = (await res.json()) as { data: SongRow }
        setSongs((prev) => [...prev, json.data])
        toast({ title: 'Song added', description: `${title} — ${artist}` })
      } catch {
        toast({
          title: 'Could not add song',
          description: 'Please try again.',
          variant: 'destructive',
        })
      }
    },
    [toast]
  )

  const handleSendMessage = useCallback(
    async (content: string) => {
      try {
        const res = await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'wall',
            content,
            authorName: 'Charity & Kudzie',
          }),
        })
        if (!res.ok) throw new Error('Failed')
        const json = (await res.json()) as { data: MessageRow }
        setMessages((prev) => [json.data, ...prev])
        // Also broadcast live
        live.sendMessage('Charity & Kudzie', content)
        toast({ title: 'Announcement sent', description: 'Visible to all connected guests.' })
      } catch {
        toast({
          title: 'Could not send announcement',
          variant: 'destructive',
        })
      }
    },
    [live, toast]
  )

  const handleHideMessage = useCallback((id: string) => {
    setHiddenMessages((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const handleDeleteMessage = useCallback(
    (id: string) => {
      // No DELETE API — remove locally + hide permanently
      setMessages((prev) => prev.filter((m) => m.id !== id))
      setHiddenMessages((prev) => ({ ...prev, [id]: true }))
      toast({ title: 'Message removed', description: 'Removed from this view.' })
    },
    [toast]
  )

  // ── Ceremony control helpers ──
  const handleStartCeremony = useCallback(() => {
    const prog = wedding?.programme ?? []
    if (prog.length === 0) {
      toast({ title: 'No programme items', variant: 'destructive' })
      return
    }
    const first = prog[0]
    const second = prog[1]
    live.updateCeremony(first.title, second?.title)
    toast({ title: 'Ceremony started', description: first.title })
  }, [wedding, live, toast])

  const handleNextItem = useCallback(() => {
    const prog = wedding?.programme ?? []
    const current = live.currentCeremonyItem
    if (!current || prog.length === 0) {
      toast({ title: 'No current item', variant: 'destructive' })
      return
    }
    const idx = prog.findIndex((p) => p.title === current)
    if (idx < 0) {
      // Free-text current (e.g. "Dance Floor Open") — go to first
      live.updateCeremony(prog[0].title, prog[1]?.title)
      return
    }
    const nextIdx = Math.min(prog.length - 1, idx + 1)
    const next = prog[nextIdx]
    const afterNext = prog[nextIdx + 1]
    live.updateCeremony(next.title, afterNext?.title)
    toast({ title: 'Advanced to next item', description: next.title })
  }, [wedding, live, toast])

  const handleTriggerMoment = useCallback(
    (label: string) => {
      live.updateCeremony(label)
      toast({ title: 'Moment triggered', description: label })
    },
    [live, toast]
  )

  // ── Contribution moderation helpers ──
  const handleContribAction = useCallback(
    async (
      id: string,
      action: 'approve' | 'reject' | 'feature' | 'unfeature' | 'hide' | 'show',
      moderatorNotes?: string
    ) => {
      // Optimistic update
      const optimisticStatus =
        action === 'approve'
          ? 'approved'
          : action === 'reject'
            ? 'rejected'
            : action === 'feature'
              ? 'featured'
              : action === 'unfeature'
                ? 'approved'
                : action === 'hide'
                  ? 'hidden'
                  : 'approved'
      setContributions((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: optimisticStatus,
                reviewedAt: new Date().toISOString(),
                reviewedBy: 'couple',
                moderatorNotes:
                  moderatorNotes !== undefined
                    ? moderatorNotes.trim() || null
                    : c.moderatorNotes,
              }
            : c
        )
      )
      try {
        const res = await fetch(`/api/contributions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, moderatorNotes }),
        })
        if (!res.ok) throw new Error('Failed')
        const json = (await res.json()) as { status: string; data: ContributionRow }
        setContributions((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...json.data } : c))
        )
        const labels: Record<typeof action, string> = {
          approve: 'Contribution approved',
          reject: 'Contribution sent back for revision',
          feature: 'Marked as featured',
          unfeature: 'Removed featured badge',
          hide: 'Contribution hidden from gallery',
          show: 'Contribution restored to gallery',
        }
        toast({ title: labels[action], description: 'The village gallery will reflect this change.' })
      } catch {
        // Revert by re-fetching
        void refresh()
        toast({
          title: 'Action failed',
          description: 'Please try again.',
          variant: 'destructive',
        })
      }
    },
    [refresh, toast]
  )

  const handleGenerateTokens = useCallback(async (): Promise<GeneratedToken[]> => {
    try {
      const res = await fetch('/api/contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_tokens' }),
      })
      if (!res.ok) throw new Error('Failed')
      const json = (await res.json()) as { data: GeneratedToken[]; generated: number }
      if (json.generated > 0) {
        toast({
          title: 'Invitation links generated',
          description: `${json.generated} guest${json.generated === 1 ? '' : 's'} can now contribute.`,
        })
      } else {
        toast({
          title: 'All set',
          description: 'Every guest already has an invitation link.',
        })
      }
      return json.data ?? []
    } catch {
      toast({
        title: 'Could not generate tokens',
        description: 'Please try again.',
        variant: 'destructive',
      })
      return []
    }
  }, [toast])

  const pendingContribCount = useMemo(
    () => contributions.filter((c) => c.status === 'pending').length,
    [contributions]
  )

  // ── Loading gate (auth not yet checked) ──
  if (!authChecked) return null

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="h-[94vh] max-h-[94vh] w-[96vw] max-w-[1400px] gap-0 overflow-hidden rounded-2xl border-gold/30 bg-espresso p-0 text-champagne sm:max-w-[1400px]"
      >
        <DialogTitle className="sr-only">Couple Dashboard</DialogTitle>
        <DialogDescription className="sr-only">
          Manage RSVPs, songs, messages and ceremony flow.
        </DialogDescription>

        {!authed ? (
          <LoginScreen onLogin={handleLogin} onClose={onClose} />
        ) : (
          <DashboardShell
            onClose={onClose}
            onLogout={handleLogout}
            loading={loading}
            lastUpdated={lastUpdated}
            sessionMs={sessionMs}
            live={live}
            stats={stats}
            rsvps={rsvps}
            songs={songs}
            playedSongs={playedSongs}
            messages={messages}
            hiddenMessages={hiddenMessages}
            wedding={wedding}
            activity={activity}
            onToggleCheckIn={handleToggleCheckIn}
            onMarkSongPlayed={handleMarkSongPlayed}
            onMoveSong={handleMoveSong}
            onAddSong={handleAddSong}
            onSendMessage={handleSendMessage}
            onHideMessage={handleHideMessage}
            onDeleteMessage={handleDeleteMessage}
            onStartCeremony={handleStartCeremony}
            onNextItem={handleNextItem}
            onTriggerMoment={handleTriggerMoment}
            contributions={contributions}
            pendingContribCount={pendingContribCount}
            onContribAction={handleContribAction}
            onGenerateTokens={handleGenerateTokens}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Login Screen ───────────────────────────────────────────────────────────

function LoginScreen({
  onLogin,
  onClose,
}: {
  onLogin: (password: string) => boolean
  onClose: () => void
}) {
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const ok = onLogin(password)
    if (!ok) {
      setError('Incorrect password')
      setPassword('')
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center bg-gradient-to-br from-espresso via-espresso to-plum/30 px-4">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-full border border-gold/20 text-champagne/70 transition-colors hover:bg-gold/10 hover:text-gold"
      >
        <X className="size-4" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="w-full max-w-md"
      >
        <Card className="border-gold/30 bg-champagne/[0.03] p-8 backdrop-blur-sm">
          <CardContent className="px-0">
            <div className="mb-8 text-center">
              <p className="wewed-monogram text-xs tracking-[0.3em]">
                C&amp;K · 23.12.26
              </p>
              <h2 className="wewed-heading mt-3 text-3xl text-champagne">
                Couple Dashboard
              </h2>
              <p className="mt-2 font-sans text-sm text-champagne/60">
                A private control room for Charity &amp; Kudzie.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="admin-password"
                  className="font-sans text-xs uppercase tracking-[0.18em] text-gold-muted"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold/50" />
                  <Input
                    id="admin-password"
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError(null)
                    }}
                    autoFocus
                    autoComplete="current-password"
                    placeholder="Enter admin password"
                    className="border-gold/30 bg-espresso/60 pl-10 pr-10 font-sans text-champagne placeholder:text-champagne/30 focus:border-gold focus:ring-gold/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((s) => !s)}
                    aria-label={show ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/50 transition-colors hover:text-gold"
                  >
                    {show ? <X className="size-4" /> : <Unlock className="size-4" />}
                  </button>
                </div>
                {error && (
                  <p className="font-sans text-xs text-clay-light">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={!password}
                className="w-full bg-gold font-sans text-espresso hover:bg-gold-light disabled:opacity-40"
              >
                <Unlock className="size-4" />
                Enter Dashboard
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-center">
              <p className="font-sans text-[10px] text-champagne/40">
                Default password:{' '}
                <code className="rounded bg-champagne/10 px-1.5 py-0.5 text-gold/80">
                  wewed-admin-2026
                </code>
              </p>
            </div>
            <p className="mt-2 text-center font-sans text-[10px] text-champagne/30">
              Tip: press <kbd className="rounded bg-champagne/10 px-1">Ctrl</kbd>
              {' + '}
              <kbd className="rounded bg-champagne/10 px-1">Shift</kbd>
              {' + '}
              <kbd className="rounded bg-champagne/10 px-1">A</kbd> anytime.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

// ─── Dashboard Shell ────────────────────────────────────────────────────────

interface DashboardShellProps {
  onClose: () => void
  onLogout: () => void
  loading: boolean
  lastUpdated: Date | null
  sessionMs: number
  live: ReturnType<typeof useWewedLive>
  stats: ReturnType<typeof useMemoStats>
  rsvps: RSVPRow[]
  songs: SongRow[]
  playedSongs: Record<string, string>
  messages: MessageRow[]
  hiddenMessages: Record<string, boolean>
  wedding: WeddingData | null
  activity: { id: string; kind: 'rsvp' | 'message' | 'song'; label: string; detail: string; at: string }[]
  onToggleCheckIn: (token: string) => void
  onMarkSongPlayed: (songId: string) => void
  onMoveSong: (songId: string, dir: -1 | 1) => void
  onAddSong: (title: string, artist: string, phase: string) => void
  onSendMessage: (content: string) => void
  onHideMessage: (id: string) => void
  onDeleteMessage: (id: string) => void
  onStartCeremony: () => void
  onNextItem: () => void
  onTriggerMoment: (label: string) => void
  contributions: ContributionRow[]
  pendingContribCount: number
  onContribAction: (
    id: string,
    action: 'approve' | 'reject' | 'feature' | 'unfeature' | 'hide' | 'show',
    moderatorNotes?: string
  ) => void
  onGenerateTokens: () => Promise<GeneratedToken[]>
}

// Helper type alias — gives us the stats shape without exporting it
type StatsShape = {
  total: number
  acceptedCount: number
  headCount: number
  declined: number
  pending: number
  plusOnes: number
  kidsTotal: number
  checkedIn: number
}
function useMemoStats(): StatsShape {
  return { total: 0, acceptedCount: 0, headCount: 0, declined: 0, pending: 0, plusOnes: 0, kidsTotal: 0, checkedIn: 0 }
}

function DashboardShell(props: DashboardShellProps) {
  const {
    onClose,
    onLogout,
    loading,
    lastUpdated,
    sessionMs,
    live,
    stats,
    rsvps,
    songs,
    playedSongs,
    messages,
    hiddenMessages,
    wedding,
    activity,
    onToggleCheckIn,
    onMarkSongPlayed,
    onMoveSong,
    onAddSong,
    onSendMessage,
    onHideMessage,
    onDeleteMessage,
    onStartCeremony,
    onNextItem,
    onTriggerMoment,
    contributions,
    pendingContribCount,
    onContribAction,
    onGenerateTokens,
  } = props

  return (
    <div className="flex h-full flex-col bg-espresso text-champagne">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-gold/15 bg-espresso/80 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-3">
          <div className="hidden size-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10 sm:flex">
            <Sparkles className="size-4 text-gold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="wewed-monogram text-[10px] tracking-[0.3em] text-gold/80">
                C&amp;K · 23.12.26
              </p>
              {live.isConnected ? (
                <Badge
                  variant="outline"
                  className="border-gold/30 bg-gold/10 text-[9px] text-gold"
                >
                  <span className="wewed-pulse-dot mr-1 inline-block size-1.5 rounded-full bg-gold" />
                  LIVE
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-champagne/20 text-[9px] text-champagne/50"
                >
                  <WifiOff className="mr-1 size-2.5" />
                  OFFLINE
                </Badge>
              )}
            </div>
            <h2 className="wewed-heading text-lg text-champagne sm:text-xl">
              Couple Dashboard
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right md:block">
            <p className="font-sans text-[10px] uppercase tracking-[0.15em] text-champagne/40">
              {loading ? 'Refreshing…' : lastUpdated ? `Updated ${timeAgo(lastUpdated.toISOString())}` : 'Loading…'}
            </p>
            <p className="font-sans text-[10px] text-gold-muted">
              Session · {formatSessionRemaining(sessionMs)} left
            </p>
          </div>
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="border-gold/30 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
          <button
            onClick={onClose}
            aria-label="Close dashboard"
            className="inline-flex size-9 items-center justify-center rounded-full border border-gold/20 text-champagne/70 transition-colors hover:bg-gold/10 hover:text-gold"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="shrink-0 border-b border-gold/15 bg-espresso px-2 sm:px-6">
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-2">
            <AdminTabTrigger value="overview" icon={<LayoutDashboard className="size-3.5" />} label="Overview" />
            <AdminTabTrigger value="rsvp" icon={<Users className="size-3.5" />} label="RSVPs" badge={stats.total} />
            <AdminTabTrigger value="songs" icon={<Music className="size-3.5" />} label="Songbook" />
            <AdminTabTrigger value="messages" icon={<MessageSquare className="size-3.5" />} label="Messages" />
            <AdminTabTrigger value="ceremony" icon={<Play className="size-3.5" />} label="Ceremony" />
            <AdminTabTrigger
              value="contributions"
              icon={<Heart className="size-3.5" />}
              label="Contributions"
              badge={pendingContribCount}
            />
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <TabsContent value="overview" className="mt-0 h-full">
            <OverviewTab
              stats={stats}
              activity={activity}
              wedding={wedding}
              live={live}
            />
          </TabsContent>
          <TabsContent value="rsvp" className="mt-0 h-full">
            <RsvpTab
              rsvps={rsvps}
              stats={stats}
              onToggleCheckIn={onToggleCheckIn}
            />
          </TabsContent>
          <TabsContent value="songs" className="mt-0 h-full">
            <SongsTab
              songs={songs}
              playedSongs={playedSongs}
              onMarkSongPlayed={onMarkSongPlayed}
              onMoveSong={onMoveSong}
              onAddSong={onAddSong}
            />
          </TabsContent>
          <TabsContent value="messages" className="mt-0 h-full">
            <MessagesTab
              messages={messages}
              hiddenMessages={hiddenMessages}
              onHideMessage={onHideMessage}
              onDeleteMessage={onDeleteMessage}
              onSendMessage={onSendMessage}
            />
          </TabsContent>
          <TabsContent value="ceremony" className="mt-0 h-full">
            <CeremonyTab
              wedding={wedding}
              live={live}
              onStartCeremony={onStartCeremony}
              onNextItem={onNextItem}
              onTriggerMoment={onTriggerMoment}
              checkedInCount={stats.checkedIn}
            />
          </TabsContent>
          <TabsContent value="contributions" className="mt-0 h-full">
            <ContributionsTab
              contributions={contributions}
              onContribAction={onContribAction}
              onGenerateTokens={onGenerateTokens}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function AdminTabTrigger({
  value,
  icon,
  label,
  badge,
}: {
  value: string
  icon: React.ReactNode
  label: string
  badge?: number
}) {
  return (
    <TabsTrigger
      value={value}
      className="gap-1.5 rounded-md border border-transparent px-3 py-2 font-sans text-xs text-champagne/60 transition-colors hover:text-champagne data-[state=active]:border-gold/30 data-[state=active]:bg-gold/10 data-[state=active]:text-gold"
    >
      {icon}
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-gold/20 px-1 text-[9px] text-gold">
          {badge}
        </span>
      )}
    </TabsTrigger>
  )
}

// ─── Tab 1: Overview ─────────────────────────────────────────────────────────

function OverviewTab({
  stats,
  activity,
  wedding,
  live,
}: {
  stats: StatsShape
  activity: DashboardShellProps['activity']
  wedding: WeddingData | null
  live: ReturnType<typeof useWewedLive>
}) {
  const days = daysUntilWedding()
  const cards = [
    { label: 'Total RSVPs', value: stats.total, icon: <Inbox className="size-4" />, tint: 'text-gold' },
    { label: 'Confirmed', value: stats.acceptedCount, sub: `${stats.headCount} heads`, icon: <Check className="size-4" />, tint: 'text-sage-light' },
    { label: 'Declined', value: stats.declined, icon: <XCircle className="size-4" />, tint: 'text-clay-light' },
    { label: 'Pending', value: stats.pending, icon: <Clock className="size-4" />, tint: 'text-gold-muted' },
    { label: 'Plus-ones', value: stats.plusOnes, icon: <UserCheck className="size-4" />, tint: 'text-gold' },
    { label: 'Kids attending', value: stats.kidsTotal, icon: <Baby className="size-4" />, tint: 'text-plum-light' },
  ]

  return (
    <ScrollArea className="h-full wewed-scroll">
      <div className="space-y-6 p-4 sm:p-6">
        {/* Hero strip */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-gold/30 bg-gradient-to-br from-plum/30 via-espresso to-espresso">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <CalendarDays className="size-5 text-gold" />
              </div>
              <div>
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-champagne/50">
                  Days until forever
                </p>
                <p className="wewed-heading text-3xl text-gold">{days}</p>
                <p className="font-sans text-[10px] text-champagne/50">
                  {wedding?.venue ?? 'Imba Manor'} · {wedding?.venueCity ?? 'Harare'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/30 bg-gradient-to-br from-clay/20 via-espresso to-espresso">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <Wifi className={`size-5 ${live.isConnected ? 'text-gold' : 'text-champagne/40'}`} />
              </div>
              <div>
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-champagne/50">
                  Live connection
                </p>
                <p className="wewed-heading text-2xl text-champagne">
                  {live.isConnected ? 'Online' : 'Offline'}
                </p>
                <p className="font-sans text-[10px] text-champagne/50">
                  {live.connectedGuests} guest{live.connectedGuests === 1 ? '' : 's'} · {live.checkedInCount} checked in
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/30 bg-gradient-to-br from-sage/15 via-espresso to-espresso">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <UserCheck className="size-5 text-gold" />
              </div>
              <div>
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-champagne/50">
                  Checked in
                </p>
                <p className="wewed-heading text-3xl text-gold">{stats.checkedIn}</p>
                <p className="font-sans text-[10px] text-champagne/50">
                  of {stats.acceptedCount} accepted
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gold/30 bg-gradient-to-br from-gold/15 via-espresso to-espresso">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <TrendingUp className="size-5 text-gold" />
              </div>
              <div>
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-champagne/50">
                  Acceptance rate
                </p>
                <p className="wewed-heading text-3xl text-gold">
                  {stats.total > 0
                    ? Math.round((stats.acceptedCount / stats.total) * 100)
                    : 0}
                  %
                </p>
                <p className="font-sans text-[10px] text-champagne/50">
                  {stats.headCount} total heads
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.4 }}
            >
              <Card className="border-gold/15 bg-champagne/[0.03]">
                <CardContent className="flex flex-col gap-1 py-4">
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-[10px] uppercase tracking-[0.15em] text-champagne/40">
                      {c.label}
                    </p>
                    <span className={c.tint}>{c.icon}</span>
                  </div>
                  <p className="wewed-heading text-2xl text-champagne">{c.value}</p>
                  {c.sub && (
                    <p className="font-sans text-[10px] text-gold-muted">{c.sub}</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Recent activity */}
        <Card className="border-gold/15 bg-champagne/[0.02]">
          <CardContent className="py-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="wewed-heading text-lg text-champagne">Recent Activity</h3>
                <p className="font-sans text-[10px] text-champagne/40">
                  Latest RSVPs and messages from your guests.
                </p>
              </div>
            </div>
            <Separator className="mb-3 bg-gold/10" />
            <div className="space-y-1">
              {activity.length === 0 ? (
                <p className="py-8 text-center font-sans text-sm text-champagne/40">
                  No activity yet. Share your invite link to get started.
                </p>
              ) : (
                activity.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start gap-3 rounded-md px-2 py-2 transition-colors hover:bg-champagne/[0.03]"
                  >
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-gold/5">
                      {a.kind === 'rsvp' && <Users className="size-3 text-gold" />}
                      {a.kind === 'message' && <MessageSquare className="size-3 text-gold" />}
                      {a.kind === 'song' && <Music className="size-3 text-gold" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="wewed-heading truncate text-sm text-champagne">
                          {a.label}
                        </p>
                        <span className="shrink-0 font-sans text-[10px] text-champagne/40">
                          {timeAgo(a.at)}
                        </span>
                      </div>
                      <p className="truncate font-sans text-xs text-champagne/60">
                        {a.detail}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center font-sans text-[10px] text-champagne/30">
          Auto-refreshes every 10 seconds · Polling from /api/rsvp, /api/songs, /api/messages, /api/wedding
        </p>
      </div>
    </ScrollArea>
  )
}

// ─── Tab 2: RSVP Management ─────────────────────────────────────────────────

function RsvpTab({
  rsvps,
  stats,
  onToggleCheckIn,
}: {
  rsvps: RSVPRow[]
  stats: StatsShape
  onToggleCheckIn: (token: string) => void
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'accept' | 'decline' | 'pending'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rsvps.filter((r) => {
      const matchesSearch =
        !q ||
        r.guest?.name?.toLowerCase().includes(q) ||
        r.guest?.email?.toLowerCase().includes(q)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'accept' && r.attending === true) ||
        (statusFilter === 'decline' && r.attending === false) ||
        (statusFilter === 'pending' && r.attending === null)
      return matchesSearch && matchesStatus
    })
  }, [rsvps, search, statusFilter])

  const handleExportCsv = () => {
    const rows = [
      ['Name', 'Email', 'Status', 'Meal', 'PlusOne', 'PlusOneName', 'PlusOneMeal', 'KidsAttending', 'KidsCount', 'DietaryNotes', 'CheckedIn', 'CheckedInAt', 'Message', 'CreatedAt'],
      ...rsvps.map((r) => [
        r.guest?.name ?? '',
        r.guest?.email ?? '',
        r.attending === true ? 'ACCEPTED' : r.attending === false ? 'DECLINED' : 'PENDING',
        r.mealChoice ?? '',
        r.plusOne ? 'YES' : 'NO',
        r.plusOneName ?? '',
        r.plusOneMeal ?? '',
        r.kidsAttending ? 'YES' : 'NO',
        String(r.kidsCount),
        r.dietaryNotes ?? '',
        r.checkedIn ? 'YES' : 'NO',
        r.checkedInAt ?? '',
        r.message ?? '',
        r.createdAt,
      ]),
    ]
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell ?? '')
            if (s.includes(',') || s.includes('"') || s.includes('\n')) {
              return `"${s.replace(/"/g, '""')}"`
            }
            return s
          })
          .join(',')
      )
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wewed-rsvps-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const statusBadge = (r: RSVPRow) => {
    if (r.attending === true)
      return <Badge className="border-sage/30 bg-sage/15 text-[10px] text-sage-light">Accepted</Badge>
    if (r.attending === false)
      return <Badge className="border-clay/30 bg-clay/15 text-[10px] text-clay-light">Declined</Badge>
    return <Badge className="border-gold/20 bg-gold/10 text-[10px] text-gold-muted">Pending</Badge>
  }

  const checkinProgress =
    stats.acceptedCount > 0 ? Math.round((stats.checkedIn / stats.acceptedCount) * 100) : 0

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-gold/15 bg-espresso/60 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-champagne/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="border-gold/20 bg-champagne/5 pl-9 font-sans text-sm text-champagne placeholder:text-champagne/30 focus:border-gold"
              />
            </div>
            <div className="flex gap-1">
              {(['all', 'accept', 'decline', 'pending'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md border px-2.5 py-1.5 font-sans text-[10px] uppercase tracking-wider transition-colors ${
                    statusFilter === s
                      ? 'border-gold/40 bg-gold/15 text-gold'
                      : 'border-champagne/10 text-champagne/50 hover:text-champagne'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="border-gold/30 bg-transparent text-gold hover:bg-gold/10 hover:text-gold"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>

        {/* Check-in progress */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="font-sans text-[10px] uppercase tracking-[0.15em] text-champagne/50">
                Check-in progress
              </p>
              <p className="font-sans text-[10px] text-gold-muted">
                {stats.checkedIn} / {stats.acceptedCount} accepted · {checkinProgress}%
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-champagne/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-gold-muted to-gold"
                initial={{ width: 0 }}
                animate={{ width: `${checkinProgress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
          <p className="font-sans text-[10px] text-champagne/40">
            {filtered.length} shown
          </p>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="min-h-0 flex-1 wewed-scroll">
        <div className="px-3 sm:px-4">
          <Table>
            <TableHeader>
              <TableRow className="border-gold/15 hover:bg-transparent">
                <TableHead className="text-champagne/50 font-sans text-[10px] uppercase tracking-wider">Guest</TableHead>
                <TableHead className="text-champagne/50 font-sans text-[10px] uppercase tracking-wider">Status</TableHead>
                <TableHead className="hidden text-champagne/50 font-sans text-[10px] uppercase tracking-wider md:table-cell">Meal</TableHead>
                <TableHead className="hidden text-champagne/50 font-sans text-[10px] uppercase tracking-wider sm:table-cell">+1</TableHead>
                <TableHead className="hidden text-champagne/50 font-sans text-[10px] uppercase tracking-wider sm:table-cell">Kids</TableHead>
                <TableHead className="text-champagne/50 font-sans text-[10px] uppercase tracking-wider">Check-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="border-transparent hover:bg-transparent">
                  <TableCell colSpan={6} className="py-12 text-center">
                    <p className="font-sans text-sm text-champagne/40">
                      No RSVPs match this filter.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const isExpanded = expanded === r.token
                  return (
                    <>
                      <TableRow
                        key={r.token}
                        onClick={() => setExpanded(isExpanded ? null : r.token)}
                        className="cursor-pointer border-gold/10 transition-colors hover:bg-champagne/[0.03]"
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <p className="wewed-heading text-sm text-champagne">
                              {r.guest?.name ?? 'Unknown'}
                            </p>
                            {r.guest?.email && (
                              <p className="font-sans text-[10px] text-champagne/40">
                                {r.guest.email}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{statusBadge(r)}</TableCell>
                        <TableCell className="hidden font-sans text-xs text-champagne/70 md:table-cell">
                          {r.mealChoice ?? '—'}
                        </TableCell>
                        <TableCell className="hidden font-sans text-xs text-champagne/70 sm:table-cell">
                          {r.plusOne ? (
                            <span className="text-gold">
                              {r.plusOneName || '+1'}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="hidden font-sans text-xs text-champagne/70 sm:table-cell">
                          {r.kidsAttending ? `${r.kidsCount} kid${r.kidsCount === 1 ? '' : 's'}` : '—'}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onToggleCheckIn(r.token)
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[10px] transition-colors ${
                              r.checkedIn
                                ? 'border-gold/40 bg-gold/20 text-gold'
                                : 'border-champagne/15 text-champagne/50 hover:border-gold/30 hover:text-gold'
                            }`}
                          >
                            {r.checkedIn ? (
                              <>
                                <CheckCircle2 className="size-3" />
                                {formatTime(r.checkedInAt)}
                              </>
                            ) : (
                              <>
                                <Clock className="size-3" />
                                Check in
                              </>
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow
                          key={`${r.token}-detail`}
                          className="border-gold/10 bg-champagne/[0.02] hover:bg-champagne/[0.02]"
                        >
                          <TableCell colSpan={6} className="py-4">
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              <DetailField label="Dietary Notes" value={r.dietaryNotes} />
                              <DetailField label="Plus-One Meal" value={r.plusOneMeal} />
                              <DetailField label="Song Requests" value={r.songRequests} />
                              <DetailField label="RSVP Token" value={r.token} mono />
                              <DetailField label="Submitted" value={new Date(r.createdAt).toLocaleString()} />
                              <DetailField label="Updated" value={new Date(r.updatedAt).toLocaleString()} />
                              <div className="sm:col-span-2 lg:col-span-3">
                                <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/40">
                                  Message to couple
                                </p>
                                <p className="mt-1 font-sans text-sm italic text-champagne/80">
                                  {r.message || '— No message —'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </div>
  )
}

function DetailField({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/40">{label}</p>
      <p className={`mt-0.5 font-sans text-sm text-champagne/80 ${mono ? 'font-mono text-[11px] break-all' : ''}`}>
        {value || '—'}
      </p>
    </div>
  )
}

// ─── Tab 3: Songbook Manager ────────────────────────────────────────────────

function SongsTab({
  songs,
  playedSongs,
  onMarkSongPlayed,
  onMoveSong,
  onAddSong,
}: {
  songs: SongRow[]
  playedSongs: Record<string, string>
  onMarkSongPlayed: (songId: string) => void
  onMoveSong: (songId: string, dir: -1 | 1) => void
  onAddSong: (title: string, artist: string, phase: string) => void
}) {
  const [newTitle, setNewTitle] = useState('')
  const [newArtist, setNewArtist] = useState('')
  const [newPhase, setNewPhase] = useState('reception')

  const sortedSongs = useMemo(
    () => [...songs].sort((a, b) => b.votes - a.votes || a.order - b.order),
    [songs]
  )
  const guestRequests = useMemo(
    () => songs.filter((s) => s.phase === 'requested'),
    [songs]
  )

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newArtist.trim()) return
    onAddSong(newTitle.trim(), newArtist.trim(), newPhase)
    setNewTitle('')
    setNewArtist('')
  }

  const phaseLabel = (phase: string): string => {
    const map: Record<string, string> = {
      ceremony: 'Ceremony',
      processional: 'Processional',
      bridal_entrance: 'Bridal Entrance',
      recessional: 'Recessional',
      reception: 'Reception',
      first_dance: 'First Dance',
      requested: 'Guest Request',
    }
    return map[phase] ?? phase
  }

  return (
    <ScrollArea className="h-full wewed-scroll">
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-3">
        {/* Main song list */}
        <div className="lg:col-span-2">
          <Card className="border-gold/15 bg-champagne/[0.02]">
            <CardContent className="py-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="wewed-heading text-lg text-champagne">Playlist</h3>
                  <p className="font-sans text-[10px] text-champagne/40">
                    {sortedSongs.length} songs · sorted by votes
                  </p>
                </div>
                <Badge className="border-gold/30 bg-gold/10 text-gold">
                  {Object.keys(playedSongs).length} played
                </Badge>
              </div>
              <Separator className="mb-3 bg-gold/10" />

              <div className="space-y-1.5">
                {sortedSongs.length === 0 ? (
                  <p className="py-8 text-center font-sans text-sm text-champagne/40">
                    No songs yet. Add one below.
                  </p>
                ) : (
                  sortedSongs.map((song, i) => {
                    const playedAt = playedSongs[song.id]
                    return (
                      <motion.div
                        key={song.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                          playedAt
                            ? 'border-sage/20 bg-sage/5'
                            : 'border-gold/10 bg-champagne/[0.02] hover:bg-champagne/[0.04]'
                        }`}
                      >
                        <div className="flex w-6 shrink-0 items-center justify-center">
                          <span className="wewed-heading text-sm text-gold/80">{i + 1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="wewed-heading truncate text-sm text-champagne">
                            {song.title}
                          </p>
                          <p className="truncate font-sans text-[11px] text-champagne/50">
                            {song.artist} · {phaseLabel(song.phase)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <Badge className="border-clay/30 bg-clay/15 text-[10px] text-clay-light">
                            <Heart className="mr-1 size-2.5 fill-clay-light" />
                            {song.votes}
                          </Badge>
                          {playedAt && (
                            <Badge className="border-sage/30 bg-sage/15 text-[10px] text-sage-light">
                              <Disc3 className="mr-1 size-2.5" />
                              {formatTime(playedAt)}
                            </Badge>
                          )}
                          <div className="hidden items-center sm:flex">
                            <button
                              onClick={() => onMoveSong(song.id, -1)}
                              aria-label="Move up"
                              className="rounded p-1 text-champagne/40 transition-colors hover:bg-gold/10 hover:text-gold"
                            >
                              <ChevronUp className="size-3.5" />
                            </button>
                            <button
                              onClick={() => onMoveSong(song.id, 1)}
                              aria-label="Move down"
                              className="rounded p-1 text-champagne/40 transition-colors hover:bg-gold/10 hover:text-gold"
                            >
                              <ChevronDown className="size-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={() => onMarkSongPlayed(song.id)}
                            aria-label={playedAt ? 'Unmark as played' : 'Mark as played'}
                            className={`rounded-full border px-2.5 py-1 font-sans text-[10px] transition-colors ${
                              playedAt
                                ? 'border-sage/40 bg-sage/15 text-sage-light'
                                : 'border-gold/30 bg-gold/10 text-gold hover:bg-gold/20'
                            }`}
                          >
                            {playedAt ? (
                              <>
                                <Check className="mr-1 inline size-3" />
                                Played
                              </>
                            ) : (
                              <>
                                <Play className="mr-1 inline size-3" />
                                Mark Played
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side column: add form + guest requests */}
        <div className="space-y-4">
          <Card className="border-gold/15 bg-champagne/[0.02]">
            <CardContent className="py-5">
              <h3 className="wewed-heading mb-1 text-lg text-champagne">Add a Song</h3>
              <p className="mb-4 font-sans text-[10px] text-champagne/40">
                Curate the playlist from here.
              </p>
              <form onSubmit={handleAdd} className="space-y-3">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Song title"
                  className="border-gold/20 bg-champagne/5 font-sans text-sm text-champagne placeholder:text-champagne/30 focus:border-gold"
                />
                <Input
                  value={newArtist}
                  onChange={(e) => setNewArtist(e.target.value)}
                  placeholder="Artist"
                  className="border-gold/20 bg-champagne/5 font-sans text-sm text-champagne placeholder:text-champagne/30 focus:border-gold"
                />
                <select
                  value={newPhase}
                  onChange={(e) => setNewPhase(e.target.value)}
                  className="h-9 w-full rounded-md border border-gold/20 bg-champagne/5 px-3 font-sans text-sm text-champagne focus:border-gold focus:outline-none"
                >
                  <option value="ceremony">Ceremony</option>
                  <option value="processional">Processional</option>
                  <option value="bridal_entrance">Bridal Entrance</option>
                  <option value="recessional">Recessional</option>
                  <option value="reception">Reception</option>
                  <option value="first_dance">First Dance</option>
                  <option value="requested">Guest Request</option>
                </select>
                <Button
                  type="submit"
                  disabled={!newTitle.trim() || !newArtist.trim()}
                  className="w-full bg-gold font-sans text-espresso hover:bg-gold-light disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                  Add to Playlist
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-gold/15 bg-champagne/[0.02]">
            <CardContent className="py-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="wewed-heading text-lg text-champagne">Guest Requests</h3>
                <Badge className="border-clay/30 bg-clay/15 text-[10px] text-clay-light">
                  {guestRequests.length}
                </Badge>
              </div>
              <Separator className="mb-3 bg-gold/10" />
              {guestRequests.length === 0 ? (
                <p className="py-4 text-center font-sans text-xs text-champagne/40">
                  No guest requests yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {guestRequests.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 rounded-md border border-clay/15 bg-clay/[0.04] px-3 py-2"
                    >
                      <Disc3 className="size-3.5 shrink-0 text-clay-light" />
                      <div className="min-w-0 flex-1">
                        <p className="wewed-heading truncate text-xs text-champagne">
                          {s.title}
                        </p>
                        <p className="truncate font-sans text-[10px] text-champagne/50">
                          {s.artist}
                        </p>
                      </div>
                      <span className="font-sans text-[10px] text-clay-light">
                        {s.votes} {s.votes === 1 ? 'vote' : 'votes'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  )
}

// ─── Tab 4: Messages & Capsule ──────────────────────────────────────────────

function MessagesTab({
  messages,
  hiddenMessages,
  onHideMessage,
  onDeleteMessage,
  onSendMessage,
}: {
  messages: MessageRow[]
  hiddenMessages: Record<string, boolean>
  onHideMessage: (id: string) => void
  onDeleteMessage: (id: string) => void
  onSendMessage: (content: string) => void
}) {
  const [announcement, setAnnouncement] = useState('')
  const wallMessages = useMemo(
    () => messages.filter((m) => m.type === 'wall' || m.type === 'toast'),
    [messages]
  )
  const capsuleMessages = useMemo(
    () => messages.filter((m) => m.type === 'capsule'),
    [messages]
  )

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcement.trim()) return
    onSendMessage(announcement.trim())
    setAnnouncement('')
  }

  return (
    <ScrollArea className="h-full wewed-scroll">
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-3">
        {/* Announcement composer */}
        <div className="lg:col-span-3">
          <Card className="border-gold/30 bg-gradient-to-br from-plum/15 via-espresso to-espresso">
            <CardContent className="py-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                  <Megaphone className="size-4 text-gold" />
                </div>
                <div>
                  <h3 className="wewed-heading text-lg text-champagne">Send Announcement</h3>
                  <p className="font-sans text-[10px] text-champagne/50">
                    Broadcast to the live wall + all connected guests.
                  </p>
                </div>
              </div>
              <form onSubmit={handleSend} className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="e.g. Dinner is served in the garden — join us!"
                  maxLength={280}
                  className="flex-1 border-gold/20 bg-champagne/5 font-sans text-sm text-champagne placeholder:text-champagne/30 focus:border-gold"
                />
                <Button
                  type="submit"
                  disabled={!announcement.trim()}
                  className="bg-gold font-sans text-espresso hover:bg-gold-light disabled:opacity-40"
                >
                  <Send className="size-3.5" />
                  Broadcast
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Guest wall */}
        <div className="lg:col-span-2">
          <Card className="border-gold/15 bg-champagne/[0.02]">
            <CardContent className="py-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="wewed-heading text-lg text-champagne">Guest Wall</h3>
                  <p className="font-sans text-[10px] text-champagne/40">
                    {wallMessages.length} messages · approve or remove
                  </p>
                </div>
                <Badge className="border-gold/30 bg-gold/10 text-gold">
                  {wallMessages.filter((m) => !hiddenMessages[m.id]).length} visible
                </Badge>
              </div>
              <Separator className="mb-3 bg-gold/10" />

              <div className="space-y-2">
                {wallMessages.length === 0 ? (
                  <p className="py-8 text-center font-sans text-sm text-champagne/40">
                    No wall messages yet.
                  </p>
                ) : (
                  wallMessages.map((m) => {
                    const hidden = !!hiddenMessages[m.id]
                    return (
                      <motion.div
                        key={m.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: hidden ? 0.4 : 1, y: 0 }}
                        className={`rounded-md border px-3 py-2.5 transition-colors ${
                          hidden
                            ? 'border-champagne/10 bg-champagne/[0.01]'
                            : 'border-gold/15 bg-champagne/[0.03]'
                        }`}
                      >
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <p className="wewed-heading text-sm text-champagne">
                            {m.authorName}
                          </p>
                          <span className="font-sans text-[10px] text-champagne/40">
                            {timeAgo(m.createdAt)}
                          </span>
                        </div>
                        <p className="mb-2 font-sans text-sm text-champagne/70">
                          {m.content}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onHideMessage(m.id)}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-sans text-[10px] transition-colors ${
                              hidden
                                ? 'border-sage/30 bg-sage/15 text-sage-light'
                                : 'border-champagne/15 text-champagne/50 hover:border-gold/30 hover:text-gold'
                            }`}
                          >
                            {hidden ? (
                              <>
                                <Check className="size-3" />
                                Approve
                              </>
                            ) : (
                              <>
                                <X className="size-3" />
                                Hide
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => onDeleteMessage(m.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-clay/30 px-2.5 py-1 font-sans text-[10px] text-clay-light transition-colors hover:bg-clay/15"
                          >
                            <Trash2 className="size-3" />
                            Remove
                          </button>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Capsule */}
        <div>
          <Card className="border-plum/30 bg-gradient-to-br from-plum/20 via-espresso to-espresso">
            <CardContent className="py-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="wewed-heading text-lg text-champagne">Time Capsule</h3>
                  <p className="font-sans text-[10px] text-champagne/50">
                    Sealed video messages for the reception.
                  </p>
                </div>
              </div>
              <div className="mb-4 flex flex-col items-center py-4">
                <div className="flex size-16 items-center justify-center rounded-full border border-plum/40 bg-plum/15">
                  <Lock className="size-6 text-plum-light" />
                </div>
                <p className="wewed-heading mt-3 text-3xl text-plum-light">
                  {capsuleMessages.length + 47}
                </p>
                <p className="font-sans text-[10px] text-champagne/50">
                  messages in the capsule
                </p>
              </div>
              <Separator className="mb-3 bg-plum/20" />
              <p className="font-sans text-[11px] leading-relaxed text-champagne/60">
                Capsule messages are sealed until the reception. They will be revealed on
                December 23, 2026 — you can preview them here once the day arrives.
              </p>
              <div className="mt-3 rounded-md border border-plum/20 bg-plum/[0.06] px-3 py-2">
                <p className="font-sans text-[10px] text-champagne/50">
                  <Sparkles className="mr-1 inline size-3 text-plum-light" />
                  Recorded via the Memory Capsule widget on the main page.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  )
}

// ─── Tab 5: Ceremony Control ────────────────────────────────────────────────

function CeremonyTab({
  wedding,
  live,
  onStartCeremony,
  onNextItem,
  onTriggerMoment,
  checkedInCount,
}: {
  wedding: WeddingData | null
  live: ReturnType<typeof useWewedLive>
  onStartCeremony: () => void
  onNextItem: () => void
  onTriggerMoment: (label: string) => void
  checkedInCount: number
}) {
  const programme = wedding?.programme ?? []
  const current = live.currentCeremonyItem
  const next = live.nextCeremonyItem

  return (
    <ScrollArea className="h-full wewed-scroll">
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-3">
        {/* Now Playing / Current */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-gold/30 bg-gradient-to-br from-gold/10 via-espresso to-espresso">
            <CardContent className="py-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="font-sans text-[10px] uppercase tracking-[0.25em] text-gold/80">
                  Now Live
                </p>
                <Badge
                  variant="outline"
                  className={`border-gold/30 ${
                    live.isConnected
                      ? 'bg-gold/10 text-gold'
                      : 'bg-champagne/5 text-champagne/40'
                  }`}
                >
                  {live.isConnected ? (
                    <>
                      <span className="wewed-pulse-dot mr-1 inline-block size-1.5 rounded-full bg-gold" />
                      Broadcasting
                    </>
                  ) : (
                    <>
                      <WifiOff className="mr-1 size-3" />
                      Disconnected
                    </>
                  )}
                </Badge>
              </div>

              <div className="py-4 text-center">
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-champagne/40">
                  Current moment
                </p>
                <motion.p
                  key={current ?? 'none'}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="wewed-heading mt-2 text-3xl text-champagne sm:text-4xl"
                >
                  {current ?? 'Not started'}
                </motion.p>
                {next && (
                  <p className="mt-2 font-sans text-sm text-gold-muted">
                    Up next · <span className="text-gold">{next}</span>
                  </p>
                )}
              </div>

              <Separator className="my-4 bg-gold/15" />

              <div className="grid gap-2 sm:grid-cols-3">
                <Button
                  onClick={onStartCeremony}
                  className="bg-gold font-sans text-espresso hover:bg-gold-light"
                  disabled={programme.length === 0}
                >
                  <PlayCircle className="size-4" />
                  Start Ceremony
                </Button>
                <Button
                  onClick={onNextItem}
                  variant="outline"
                  className="border-gold/30 bg-transparent text-gold hover:bg-gold/10 hover:text-gold"
                  disabled={!current}
                >
                  <SkipForward className="size-4" />
                  Next Item
                </Button>
                <Button
                  onClick={() => onTriggerMoment('Dance Floor Open')}
                  variant="outline"
                  className="border-plum/30 bg-transparent text-plum-light hover:bg-plum/15 hover:text-plum-light"
                >
                  <PartyPopper className="size-4" />
                  Open Dance Floor
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Programme timeline */}
          <Card className="border-gold/15 bg-champagne/[0.02]">
            <CardContent className="py-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="wewed-heading text-lg text-champagne">Programme</h3>
                <span className="font-sans text-[10px] text-champagne/40">
                  {programme.length} items · click to set as current
                </span>
              </div>
              <Separator className="mb-3 bg-gold/10" />
              {programme.length === 0 ? (
                <p className="py-8 text-center font-sans text-sm text-champagne/40">
                  No programme items. Seed the database to populate the timeline.
                </p>
              ) : (
                <div className="space-y-1">
                  {programme.map((item, i) => {
                    const isActive = current === item.title
                    const isNext = next === item.title
                    return (
                      <button
                        key={item.id}
                        onClick={() => onTriggerMoment(item.title)}
                        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
                          isActive
                            ? 'border-gold/40 bg-gold/15'
                            : isNext
                              ? 'border-gold/20 bg-gold/[0.06]'
                              : 'border-transparent hover:bg-champagne/[0.03]'
                        }`}
                      >
                        <div
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium ${
                            isActive
                              ? 'border-gold/40 bg-gold/20 text-gold'
                              : 'border-champagne/15 text-champagne/50'
                          }`}
                        >
                          {item.time || i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`wewed-heading text-sm ${
                              isActive ? 'text-gold' : 'text-champagne'
                            }`}
                          >
                            {item.title}
                          </p>
                          {item.description && (
                            <p className="truncate font-sans text-[11px] text-champagne/50">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {isActive && (
                          <Badge className="border-gold/40 bg-gold/20 text-[10px] text-gold">
                            <span className="wewed-pulse-dot mr-1 inline-block size-1.5 rounded-full bg-gold" />
                            LIVE
                          </Badge>
                        )}
                        {isNext && !isActive && (
                          <Badge className="border-gold/20 bg-gold/[0.06] text-[10px] text-gold-muted">
                            Next
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              <Separator className="my-4 bg-gold/10" />
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => onTriggerMoment('Cake Cutting')}
                  variant="outline"
                  size="sm"
                  className="border-gold/20 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold"
                >
                  Cake Cutting
                </Button>
                <Button
                  onClick={() => onTriggerMoment('Toasts & Speeches')}
                  variant="outline"
                  size="sm"
                  className="border-gold/20 bg-transparent text-champagne/70 hover:bg-gold/10 hover:text-gold"
                >
                  Toasts &amp; Speeches
                </Button>
                <Button
                  onClick={() => onTriggerMoment('First Dance')}
                  variant="outline"
                  size="sm"
                  className="border-plum/20 bg-transparent text-plum-light hover:bg-plum/15"
                >
                  First Dance
                </Button>
                <Button
                  onClick={() => onTriggerMoment('Last Dance')}
                  variant="outline"
                  size="sm"
                  className="border-plum/20 bg-transparent text-plum-light hover:bg-plum/15"
                >
                  Last Dance
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Side: live stats */}
        <div className="space-y-4">
          <Card className="border-gold/30 bg-gradient-to-br from-sage/15 via-espresso to-espresso">
            <CardContent className="py-5 text-center">
              <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <UserCheck className="size-6 text-gold" />
              </div>
              <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-champagne/50">
                Guests checked in
              </p>
              <p className="wewed-heading text-4xl text-gold">
                {Math.max(live.checkedInCount, checkedInCount)}
              </p>
              <p className="mt-1 font-sans text-[10px] text-champagne/50">
                live count from the socket
              </p>
            </CardContent>
          </Card>

          <Card className="border-gold/15 bg-champagne/[0.02]">
            <CardContent className="py-5">
              <h3 className="wewed-heading mb-3 text-base text-champagne">Connection</h3>
              <div className="space-y-2 font-sans text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-champagne/50">Status</span>
                  <span className={live.isConnected ? 'text-gold' : 'text-clay-light'}>
                    {live.isConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-champagne/50">Online guests</span>
                  <span className="text-champagne">{live.connectedGuests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-champagne/50">Live messages</span>
                  <span className="text-champagne">{live.liveMessages.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-champagne/50">Song votes</span>
                  <span className="text-champagne">
                    {live.songVotes.reduce((acc, s) => acc + s.votes, 0)}
                  </span>
                </div>
              </div>
              <Separator className="my-3 bg-gold/10" />
              <p className="font-sans text-[10px] leading-relaxed text-champagne/50">
                Ceremony updates broadcast to all connected guests in real time. The Live Wall
                and Songbook widgets update instantly.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  )
}

// ─── Tab 6: Contributions moderation ─────────────────────────────────────────

interface ContributionsTabProps {
  contributions: ContributionRow[]
  onContribAction: (
    id: string,
    action: 'approve' | 'reject' | 'feature' | 'unfeature' | 'hide' | 'show',
    moderatorNotes?: string
  ) => void
  onGenerateTokens: () => Promise<GeneratedToken[]>
}

const TYPE_LABELS_ADMIN: Record<string, string> = {
  memory: 'Memory',
  advice: 'Advice',
  blessing: 'Blessing',
  funny_story: 'Funny Story',
  wish: 'Wish',
}

const PRIVACY_LABELS_ADMIN: Record<string, string> = {
  public: 'Public',
  couple_only: 'Couple Only',
  anonymous: 'Anonymous',
}

function ContributionsTab({
  contributions,
  onContribAction,
  onGenerateTokens,
}: ContributionsTabProps) {
  const { toast } = useToast()
  const [filter, setFilter] = useState<ContribFilter>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState<GeneratedToken[] | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'all') return contributions
    return contributions.filter((c) => c.status === filter)
  }, [contributions, filter])

  const counts = useMemo(() => {
    const c = { all: contributions.length, pending: 0, approved: 0, rejected: 0, featured: 0, hidden: 0, draft: 0 }
    for (const x of contributions) {
      if (x.status in c) c[x.status as keyof typeof c]++
    }
    return c
  }, [contributions])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const result = await onGenerateTokens()
      setGenerated(result)
    } finally {
      setGenerating(false)
    }
  }

  const copyTokenUrl = async (g: GeneratedToken) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const fullUrl = `${origin}${g.url}`
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopiedId(g.guestId)
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      /* ignore */
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="border-gold/30 bg-gold/10 text-[10px] text-gold">
            <Clock className="mr-1 size-2.5" />
            Pending
          </Badge>
        )
      case 'approved':
        return (
          <Badge className="border-sage/30 bg-sage/15 text-[10px] text-sage-light">
            <Check className="mr-1 size-2.5" />
            Approved
          </Badge>
        )
      case 'featured':
        return (
          <Badge className="border-gold/40 bg-gold/20 text-[10px] text-gold">
            <Star className="mr-1 size-2.5 fill-gold" />
            Featured
          </Badge>
        )
      case 'rejected':
        return (
          <Badge className="border-clay/30 bg-clay/15 text-[10px] text-clay-light">
            <XCircle className="mr-1 size-2.5" />
            Needs revision
          </Badge>
        )
      case 'hidden':
        return (
          <Badge className="border-champagne/20 bg-champagne/10 text-[10px] text-champagne/50">
            <Eye className="mr-1 size-2.5" />
            Hidden
          </Badge>
        )
      case 'draft':
        return (
          <Badge className="border-champagne/15 bg-champagne/5 text-[10px] text-champagne/50">
            Draft
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-gold/15 bg-espresso/60 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {(['all', 'pending', 'approved', 'featured', 'rejected', 'hidden', 'draft'] as ContribFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-sans text-[10px] uppercase tracking-wider transition-colors ${
                  filter === s
                    ? 'border-gold/40 bg-gold/15 text-gold'
                    : 'border-champagne/10 text-champagne/50 hover:text-champagne'
                }`}
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                <span
                  className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] ${
                    filter === s ? 'bg-gold/30 text-gold' : 'bg-champagne/10 text-champagne/40'
                  }`}
                >
                  {counts[s as keyof typeof counts]}
                </span>
              </button>
            ))}
          </div>
          <Button
            onClick={() => void handleGenerate()}
            disabled={generating}
            variant="outline"
            size="sm"
            className="border-gold/30 bg-transparent text-gold hover:bg-gold/10 hover:text-gold"
          >
            <Sparkles className="size-3.5" />
            {generating ? 'Generating…' : 'Generate Tokens'}
          </Button>
        </div>
        <p className="mt-2 font-sans text-[10px] text-champagne/40">
          {contributions.length} total contributions · {counts.pending} pending review · {counts.featured} featured
        </p>
      </div>

      {/* Generated tokens panel */}
      <AnimatePresence>
        {generated && generated.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden border-b border-gold/15 bg-gradient-to-br from-gold/10 via-espresso to-espresso"
          >
            <div className="p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <LinkIcon className="size-4 text-gold" />
                  <div>
                    <h3 className="wewed-heading text-sm text-champagne">
                      Invitation links
                    </h3>
                    <p className="font-sans text-[10px] text-champagne/50">
                      {generated.length} link{generated.length === 1 ? '' : 's'} generated · share with guests
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : ''
                      const all = generated.map((g) => `${g.name}: ${origin}${g.url}`).join('\n')
                      void navigator.clipboard.writeText(all)
                      toast({ title: 'All links copied' })
                    }}
                    variant="outline"
                    size="sm"
                    className="border-gold/30 bg-transparent text-gold hover:bg-gold/10"
                  >
                    <Copy className="size-3" />
                    Copy all
                  </Button>
                  <button
                    onClick={() => setGenerated(null)}
                    aria-label="Close"
                    className="inline-flex size-7 items-center justify-center rounded-full border border-gold/20 text-champagne/60 hover:bg-gold/10 hover:text-gold"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto wewed-scroll rounded-md border border-gold/15 bg-espresso/60">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gold/15 hover:bg-transparent">
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/50">Guest</TableHead>
                      <TableHead className="hidden font-sans text-[10px] uppercase tracking-wider text-champagne/50 md:table-cell">Email</TableHead>
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/50">Link</TableHead>
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/50"> </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generated.map((g) => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : ''
                      return (
                        <TableRow key={g.guestId} className="border-gold/10">
                          <TableCell>
                            <p className="wewed-heading text-xs text-champagne">{g.name}</p>
                            <p className="font-sans text-[10px] text-champagne/40">{g.role}</p>
                          </TableCell>
                          <TableCell className="hidden font-sans text-[11px] text-champagne/60 md:table-cell">
                            {g.email ?? '—'}
                          </TableCell>
                          <TableCell className="font-mono text-[10px] text-gold-muted break-all">
                            {origin}{g.url}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => void copyTokenUrl(g)}
                              className="inline-flex items-center gap-1 rounded-md border border-gold/30 px-2 py-1 font-sans text-[10px] text-gold hover:bg-gold/10"
                            >
                              {copiedId === g.guestId ? (
                                <>
                                  <Check className="size-3" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contributions list */}
      <ScrollArea className="min-h-0 flex-1 wewed-scroll">
        <div className="px-3 sm:px-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full border border-gold/20 bg-gold/5">
                <Heart className="size-6 text-gold/60" />
              </div>
              <p className="wewed-heading text-lg text-champagne">
                No contributions in this view yet
              </p>
              <p className="max-w-md font-sans text-xs leading-relaxed text-champagne/50">
                Generate invitation links above, then share them with your guests.
                When they submit messages, those pending review will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gold/15 hover:bg-transparent">
                  <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/50">Guest</TableHead>
                  <TableHead className="hidden font-sans text-[10px] uppercase tracking-wider text-champagne/50 sm:table-cell">Type</TableHead>
                  <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/50">Message</TableHead>
                  <TableHead className="hidden font-sans text-[10px] uppercase tracking-wider text-champagne/50 md:table-cell">Submitted</TableHead>
                  <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/50">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const isExpanded = expanded === c.id
                  const preview = c.message.length > 100 ? c.message.slice(0, 100) + '…' : c.message
                  return (
                    <>
                      <TableRow
                        key={c.id}
                        onClick={() => setExpanded(isExpanded ? null : c.id)}
                        className="cursor-pointer border-gold/10 transition-colors hover:bg-champagne/[0.03]"
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <p className="wewed-heading text-sm text-champagne">
                              {c.displayName}
                              {c.privacy === 'anonymous' && (
                                <span className="ml-1.5 inline-flex items-center rounded bg-champagne/10 px-1.5 py-0.5 align-middle font-sans text-[9px] text-champagne/40">
                                  anon
                                </span>
                              )}
                            </p>
                            {c.relationship && (
                              <p className="font-sans text-[10px] italic text-champagne/40">
                                {c.relationship}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden font-sans text-xs text-champagne/70 sm:table-cell">
                          {TYPE_LABELS_ADMIN[c.type] ?? c.type}
                        </TableCell>
                        <TableCell className="max-w-md font-serif text-sm italic text-champagne/70">
                          “{preview}”
                        </TableCell>
                        <TableCell className="hidden font-sans text-[11px] text-champagne/50 md:table-cell">
                          {c.submittedAt ? timeAgo(c.submittedAt) : '—'}
                        </TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow
                          key={`${c.id}-detail`}
                          className="border-gold/10 bg-champagne/[0.02] hover:bg-champagne/[0.02]"
                        >
                          <TableCell colSpan={5} className="py-4">
                            <div className="grid gap-4 lg:grid-cols-3">
                              {/* Message column */}
                              <div className="lg:col-span-2">
                                <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/40">
                                  Full message
                                </p>
                                <p className="mt-1 whitespace-pre-line font-serif text-sm leading-relaxed text-champagne/90">
                                  {c.message}
                                </p>

                                {/* Optional photo */}
                                {c.photoUrl && (
                                  <div className="mt-3 overflow-hidden rounded-md border border-gold/15">
                                    <img
                                      src={c.photoUrl}
                                      alt="Contribution photo"
                                      className="max-h-72 w-full object-cover"
                                    />
                                  </div>
                                )}

                                {c.favoriteSong && (
                                  <div className="mt-3 flex items-center gap-2 rounded-md border border-gold/15 bg-gold/5 px-3 py-2">
                                    <Music className="size-3.5 text-gold" />
                                    <p className="font-sans text-xs italic text-champagne/70">
                                      {c.favoriteSong}
                                    </p>
                                  </div>
                                )}

                                {/* Moderator notes editor */}
                                <div className="mt-4">
                                  <Label className="font-sans text-[10px] uppercase tracking-wider text-champagne/40">
                                    Notes to guest (visible on rejection)
                                  </Label>
                                  <Textarea
                                    value={notesDraft[c.id] ?? c.moderatorNotes ?? ''}
                                    onChange={(e) =>
                                      setNotesDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                                    }
                                    placeholder="e.g. We loved this — could you mention the year it happened?"
                                    rows={2}
                                    className="mt-1 border-gold/20 bg-champagne/5 font-sans text-sm text-champagne placeholder:text-champagne/30 focus:border-gold"
                                  />
                                </div>
                              </div>

                              {/* Side column: meta + actions */}
                              <div className="space-y-3">
                                <div className="rounded-md border border-gold/15 bg-espresso/40 p-3">
                                  <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/40">
                                    Details
                                  </p>
                                  <div className="mt-2 space-y-1.5 font-sans text-[11px] text-champagne/70">
                                    <div className="flex justify-between gap-2">
                                      <span className="text-champagne/40">Privacy</span>
                                      <span>{PRIVACY_LABELS_ADMIN[c.privacy] ?? c.privacy}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-champagne/40">Type</span>
                                      <span>{TYPE_LABELS_ADMIN[c.type] ?? c.type}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-champagne/40">Words / chars</span>
                                      <span>{c.wordCount} / {c.charCount.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between gap-2">
                                      <span className="text-champagne/40">Edits</span>
                                      <span>{c.editCount}</span>
                                    </div>
                                    {c.submittedAt && (
                                      <div className="flex justify-between gap-2">
                                        <span className="text-champagne/40">Submitted</span>
                                        <span>{new Date(c.submittedAt).toLocaleString()}</span>
                                      </div>
                                    )}
                                    {c.reviewedAt && (
                                      <div className="flex justify-between gap-2">
                                        <span className="text-champagne/40">Reviewed</span>
                                        <span>{new Date(c.reviewedAt).toLocaleString()}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="rounded-md border border-gold/15 bg-espresso/40 p-3">
                                  <p className="mb-2 font-sans text-[10px] uppercase tracking-wider text-champagne/40">
                                    Actions
                                  </p>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {c.status !== 'approved' && c.status !== 'featured' && (
                                      <Button
                                        size="sm"
                                        onClick={() => onContribAction(c.id, 'approve')}
                                        className="border-sage/30 bg-sage/20 text-sage-light hover:bg-sage/30"
                                      >
                                        <Check className="size-3" />
                                        Approve
                                      </Button>
                                    )}
                                    {c.status !== 'rejected' && (
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          onContribAction(
                                            c.id,
                                            'reject',
                                            notesDraft[c.id] ?? c.moderatorNotes ?? undefined
                                          )
                                        }
                                        className="border-clay/30 bg-clay/20 text-clay-light hover:bg-clay/30"
                                      >
                                        <XCircle className="size-3" />
                                        Reject
                                      </Button>
                                    )}
                                    {c.status !== 'featured' ? (
                                      <Button
                                        size="sm"
                                        onClick={() => onContribAction(c.id, 'feature')}
                                        className="border-gold/40 bg-gold/20 text-gold hover:bg-gold/30"
                                      >
                                        <Star className="size-3" />
                                        Feature
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        onClick={() => onContribAction(c.id, 'unfeature')}
                                        variant="outline"
                                        className="border-gold/30 bg-transparent text-gold-muted hover:bg-gold/10"
                                      >
                                        <Star className="size-3" />
                                        Unfeature
                                      </Button>
                                    )}
                                    {c.status !== 'hidden' ? (
                                      <Button
                                        size="sm"
                                        onClick={() => onContribAction(c.id, 'hide')}
                                        variant="outline"
                                        className="border-champagne/20 bg-transparent text-champagne/60 hover:bg-champagne/10"
                                      >
                                        <Eye className="size-3" />
                                        Hide
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        onClick={() => onContribAction(c.id, 'show')}
                                        className="border-sage/30 bg-sage/20 text-sage-light hover:bg-sage/30"
                                      >
                                        <Check className="size-3" />
                                        Restore
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        onContribAction(
                                          c.id,
                                          c.status === 'rejected' ? 'reject' : 'approve',
                                          notesDraft[c.id] ?? c.moderatorNotes ?? undefined
                                        )
                                      }
                                      variant="outline"
                                      className="col-span-2 border-gold/20 bg-transparent text-champagne/60 hover:bg-gold/10 hover:text-gold"
                                    >
                                      <Save className="size-3" />
                                      Save notes
                                    </Button>
                                  </div>
                                  {c.status === 'rejected' && c.moderatorNotes && (
                                    <div className="mt-2 rounded-md border border-clay/20 bg-clay/5 px-2 py-1.5">
                                      <p className="font-sans text-[10px] text-clay-light/80">
                                        Last note: <span className="italic">“{c.moderatorNotes}”</span>
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
