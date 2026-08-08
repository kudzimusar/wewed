'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown,
  Diamond,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileText,
  Settings as SettingsIcon,
  Download,
  Check,
  X,
  AlertCircle,
  Info,
  Sparkles,
  CalendarClock,
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Building2,
  Plane,
  ShoppingBag,
  Megaphone,
  Shirt,
  BookOpen,
  Gift,
  Users,
  Receipt,
  Lock,
  History,
  Printer,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RoyaltyEnrolment } from '@/components/wedding/royalty-enrolment'
import { useToast } from '@/hooks/use-toast'

/* ============================================================
   wewed Royalty — Dashboard
   ------------------------------------------------------------
   Self-contained Royalty dashboard embedded as a tab in the
   admin dashboard. Calls /api/royalty* endpoints. Renders six
   sub-tabs: Overview, Earnings, Partners, Payouts, Statements,
   Settings. Designed to match the wewed brand: espresso bg,
   gold accents, champagne cards, serif headings.
   ============================================================ */

const ROYALTY_RATE_BPS = 500 // 5.00%
const ROYALTY_RATE_PCT = (ROYALTY_RATE_BPS / 100).toFixed(2) + '%'
const PAYOUT_THRESHOLD = 25 // USD

// ─── Types ──────────────────────────────────────────────────────────────────

type RoyaltyStatus =
  | 'estimated'
  | 'pending'
  | 'confirmed'
  | 'payable'
  | 'paid'
  | 'reversed'
  | 'disputed'

type SourceType =
  | 'venue'
  | 'vendors'
  | 'travel'
  | 'merchandise'
  | 'advertising'
  | 'clothing'
  | 'memory_books'
  | 'anniversary'
  | 'referrals'

interface RoyaltySummary {
  totalRoyaltyCents: number
  estimatedCents: number
  pendingCents: number
  confirmedCents: number
  payableCents: number
  paidCents: number
  reversedCents: number
  currency: string
  enrolled: boolean
  termsVersion: string | null
  termsAcceptedAt: string | null
  nextSettlementAt: string | null
  attributionWindowDays: number
  rateBps: number
  payoutThresholdCents: number
  bySource: { source: SourceType; revenueCents: number; royaltyCents: number }[]
}

interface LedgerEntry {
  id: string
  date: string
  source: SourceType
  description: string
  platformRevenueCents: number
  qualifyingRevenueCents: number
  rateBps: number
  royaltyCents: number
  status: RoyaltyStatus
  partnerRef?: string | null
  guestRef?: string | null
  notes?: string | null
}

interface MonetisationCategory {
  key: SourceType
  label: string
  enabled: boolean
  approvedPartners: number
  placementRules: string
  icon: React.ReactNode
}

interface PayoutAccount {
  id: string
  provider: 'stripe' | 'paypal' | 'bank' | 'mobile_money'
  displayName: string
  maskedIdentifier: string
  status: 'active' | 'pending' | 'failed' | 'disabled'
  isDefault: boolean
}

interface PayoutRecord {
  id: string
  requestedAt: string
  amountCents: number
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  provider: string
  reference: string | null
  completedAt: string | null
}

interface AuditEvent {
  id: string
  at: string
  type: string
  description: string
  actor: string
}

interface StatementFilters {
  from: string
  to: string
  source: SourceType | 'all'
  status: RoyaltyStatus | 'all'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(cents: number, currency = 'USD'): string {
  const value = (cents || 0) / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function sourceLabel(s: SourceType): string {
  return {
    venue: 'Venue',
    vendors: 'Vendors',
    travel: 'Travel',
    merchandise: 'Merchandise',
    advertising: 'Advertising',
    clothing: 'Clothing',
    memory_books: 'Memory Books',
    anniversary: 'Anniversary',
    referrals: 'Referrals',
  }[s]
}

const STATUS_META: Record<
  RoyaltyStatus,
  { label: string; className: string; dot: string }
> = {
  estimated: {
    label: 'Estimated',
    className: 'bg-gold/15 text-gold hover:bg-gold/20 border-gold/30',
    dot: 'bg-gold',
  },
  pending: {
    label: 'Pending',
    className: 'bg-gold-light/15 text-gold-light hover:bg-gold-light/20 border-gold-light/30',
    dot: 'bg-gold-light',
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-sage/15 text-sage-light hover:bg-sage/20 border-sage/30',
    dot: 'bg-sage-light',
  },
  payable: {
    label: 'Payable',
    className: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  paid: {
    label: 'Paid',
    className: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  reversed: {
    label: 'Reversed',
    className: 'bg-clay/15 text-clay-light hover:bg-clay/20 border-clay/30',
    dot: 'bg-clay-light',
  },
  disputed: {
    label: 'Disputed',
    className: 'bg-clay/15 text-clay-light hover:bg-clay/20 border-clay/30',
    dot: 'bg-clay-light',
  },
}

const PAYOUT_STATUS_META: Record<
  PayoutRecord['status'],
  { label: string; className: string }
> = {
  pending: {
    label: 'Pending',
    className: 'bg-gold/15 text-gold hover:bg-gold/20 border-gold/30',
  },
  processing: {
    label: 'Processing',
    className: 'bg-gold-light/15 text-gold-light hover:bg-gold-light/20 border-gold-light/30',
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30',
  },
  failed: {
    label: 'Failed',
    className: 'bg-clay/15 text-clay-light hover:bg-clay/20 border-clay/30',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-espresso/10 text-espresso/50 hover:bg-espresso/15 border-espresso/20',
  },
}

const ACCOUNT_STATUS_META: Record<
  PayoutAccount['status'],
  { label: string; className: string }
> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30',
  },
  pending: {
    label: 'Pending',
    className: 'bg-gold/15 text-gold hover:bg-gold/20 border-gold/30',
  },
  failed: {
    label: 'Failed',
    className: 'bg-clay/15 text-clay-light hover:bg-clay/20 border-clay/30',
  },
  disabled: {
    label: 'Disabled',
    className: 'bg-espresso/10 text-espresso/50 hover:bg-espresso/15 border-espresso/20',
  },
}

const CATEGORY_META: Record<SourceType, { label: string; icon: React.ReactNode }> = {
  venue: { label: 'Venue', icon: <Building2 className="size-3.5" /> },
  vendors: { label: 'Vendors', icon: <ShoppingBag className="size-3.5" /> },
  travel: { label: 'Travel', icon: <Plane className="size-3.5" /> },
  merchandise: { label: 'Merchandise', icon: <Gift className="size-3.5" /> },
  advertising: { label: 'Advertising', icon: <Megaphone className="size-3.5" /> },
  clothing: { label: 'Clothing', icon: <Shirt className="size-3.5" /> },
  memory_books: { label: 'Memory Books', icon: <BookOpen className="size-3.5" /> },
  anniversary: { label: 'Anniversary', icon: <Sparkles className="size-3.5" /> },
  referrals: { label: 'Referrals', icon: <Users className="size-3.5" /> },
}

// ─── Fetch helper ───────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `${res.status} ${res.statusText}`)
  }
  const json = (await res.json()) as { success?: boolean; data?: T } & T
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T
  }
  return json as T
}

// ─── Main component ─────────────────────────────────────────────────────────

export function RoyaltyDashboard() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState('overview')
  const [summary, setSummary] = React.useState<RoyaltySummary | null>(null)
  const [summaryLoading, setSummaryLoading] = React.useState(true)
  const [summaryError, setSummaryError] = React.useState<string | null>(null)
  const [enrolOpen, setEnrolOpen] = React.useState(false)

  const loadSummary = React.useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const data = await fetchJson<RoyaltySummary>('/api/royalty')
      setSummary(data)
    } catch (err) {
      setSummaryError(
        err instanceof Error ? err.message : 'Unable to load royalty summary.',
      )
    } finally {
      setSummaryLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const handleEnrolled = React.useCallback(() => {
    void loadSummary()
    toast({
      title: 'Royalty enabled',
      description: 'Your wedding can now earn from qualifying revenue.',
    })
  }, [loadSummary, toast])

  // ── Not enrolled state ──
  if (
    !summaryLoading &&
    !summaryError &&
    summary &&
    !summary.enrolled
  ) {
    return (
      <NotEnrolledState onEnable={() => setEnrolOpen(true)}>
        <RoyaltyEnrolment
          open={enrolOpen}
          onOpenChange={setEnrolOpen}
          onAccepted={handleEnrolled}
        />
      </NotEnrolledState>
    )
  }

  return (
    <div className="flex h-full flex-col bg-espresso text-champagne">
      {/* Sub-tabs header */}
      <div className="shrink-0 border-b border-gold/15 bg-espresso/95 px-3 pt-3 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Crown className="size-3.5 text-gold" />
              <span className="font-sans text-[10px] uppercase tracking-[0.32em] text-gold">
                wewed Royalty
              </span>
              {summary?.enrolled && (
                <Badge className="border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-sans text-[9px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/15">
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-400" />
                  Enrolled
                </Badge>
              )}
            </div>
            <p className="wewed-heading mt-1 text-lg text-champagne sm:text-xl">
              Your wedding creates value. We share it with you.
            </p>
          </div>
          <div className="flex items-center gap-2 font-sans text-[11px] text-champagne/60">
            <span className="rounded-md border border-gold/20 bg-gold/5 px-2 py-1">
              Rate <span className="font-mono text-gold-light">{ROYALTY_RATE_PCT}</span>
            </span>
            <span className="rounded-md border border-gold/20 bg-gold/5 px-2 py-1">
              Threshold{' '}
              <span className="font-mono text-gold-light">
                ${PAYOUT_THRESHOLD.toFixed(2)}
              </span>
            </span>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="mt-3 flex min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0 pb-2">
            {[
              { value: 'overview', icon: <TrendingUp className="size-3.5" />, label: 'Overview' },
              { value: 'earnings', icon: <Receipt className="size-3.5" />, label: 'Earnings' },
              { value: 'partners', icon: <Users className="size-3.5" />, label: 'Partners' },
              { value: 'payouts', icon: <Wallet className="size-3.5" />, label: 'Payouts' },
              { value: 'statements', icon: <FileText className="size-3.5" />, label: 'Statements' },
              { value: 'settings', icon: <SettingsIcon className="size-3.5" />, label: 'Settings' },
            ].map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="gap-1.5 rounded-md border border-transparent px-3 py-1.5 font-sans text-xs text-champagne/55 transition-colors hover:text-champagne data-[state=active]:border-gold/30 data-[state=active]:bg-gold/10 data-[state=active]:text-gold"
              >
                {t.icon}
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-hidden">
            <TabsContent value="overview" className="mt-0 h-full">
              <OverviewTab
                summary={summary}
                loading={summaryLoading}
                error={summaryError}
                onRetry={loadSummary}
              />
            </TabsContent>
            <TabsContent value="earnings" className="mt-0 h-full">
              <EarningsTab />
            </TabsContent>
            <TabsContent value="partners" className="mt-0 h-full">
              <PartnersTab onEnable={() => setEnrolOpen(true)} />
            </TabsContent>
            <TabsContent value="payouts" className="mt-0 h-full">
              <PayoutsTab payableCents={summary?.payableCents ?? 0} />
            </TabsContent>
            <TabsContent value="statements" className="mt-0 h-full">
              <StatementsTab />
            </TabsContent>
            <TabsContent value="settings" className="mt-0 h-full">
              <SettingsTab
                summary={summary}
                onChanged={loadSummary}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <RoyaltyEnrolment
        open={enrolOpen}
        onOpenChange={setEnrolOpen}
        onAccepted={handleEnrolled}
      />
    </div>
  )
}

/* ============================================================
   Not-enrolled state
   ============================================================ */

function NotEnrolledState({
  children,
  onEnable,
}: {
  children: React.ReactNode
  onEnable: () => void
}) {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-espresso px-6 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 size-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 size-72 rounded-full bg-plum/15 blur-3xl" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative max-w-lg text-center"
      >
        <div className="mx-auto mb-6 inline-flex size-20 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/30">
          <Crown className="size-9 text-gold" />
        </div>
        <p className="wewed-monogram text-xs uppercase tracking-[0.32em] text-gold">
          wewed Royalty
        </p>
        <h2 className="wewed-heading mt-3 text-3xl text-champagne sm:text-4xl">
          Your wedding creates value.
          <br />
          <span className="text-gold">We share it with you.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-champagne/65">
          Couples earn a 5% royalty on qualifying revenue generated through
          their Forever Page — vendors, travel, merchandise, memory books and
          more. Enable the programme to begin tracking every qualifying
          transaction in your Royalty ledger.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { value: '5%', label: 'Royalty rate' },
            { value: '$25', label: 'Payout threshold' },
            { value: 'Quarterly', label: 'Settlement cycle' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-gold/20 bg-champagne/[0.04] px-3 py-3"
            >
              <p className="wewed-heading text-2xl text-gold-light">{stat.value}</p>
              <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <Button
          onClick={onEnable}
          className="mt-8 gap-2 bg-gold text-espresso hover:bg-gold-light"
        >
          <Sparkles className="size-4" />
          Enable wewed Royalty
        </Button>
      </motion.div>
      {children}
    </div>
  )
}

/* ============================================================
   Sub-tab 1: Overview
   ============================================================ */

function OverviewTab({
  summary,
  loading,
  error,
  onRetry,
}: {
  summary: RoyaltySummary | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) return <TabSkeleton />
  if (error) return <ErrorBlock message={error} onRetry={onRetry} />
  if (!summary) return <ErrorBlock message="No data" onRetry={onRetry} />

  const cards: {
    label: string
    value: number
    icon: React.ReactNode
    tint: string
    hint?: string
  }[] = [
    {
      label: 'Total Royalty',
      value: summary.totalRoyaltyCents,
      icon: <Crown className="size-4" />,
      tint: 'text-gold',
      hint: 'All-time accrued',
    },
    {
      label: 'Estimated',
      value: summary.estimatedCents,
      icon: <TrendingUp className="size-4" />,
      tint: 'text-gold-light',
      hint: 'Awaiting confirmation',
    },
    {
      label: 'Pending',
      value: summary.pendingCents,
      icon: <CalendarClock className="size-4" />,
      tint: 'text-gold-light',
      hint: 'In refund window',
    },
    {
      label: 'Confirmed',
      value: summary.confirmedCents,
      icon: <Check className="size-4" />,
      tint: 'text-sage-light',
      hint: 'Past refund window',
    },
    {
      label: 'Payable',
      value: summary.payableCents,
      icon: <Wallet className="size-4" />,
      tint: 'text-emerald-400',
      hint: 'Eligible for payout',
    },
    {
      label: 'Paid',
      value: summary.paidCents,
      icon: <DollarSign className="size-4" />,
      tint: 'text-emerald-400',
      hint: 'Settled to date',
    },
    {
      label: 'Reversed',
      value: summary.reversedCents,
      icon: <TrendingDown className="size-4" />,
      tint: 'text-clay-light',
      hint: 'Refunds & chargebacks',
    },
  ]

  const maxSourceRevenue = Math.max(
    1,
    ...summary.bySource.map((s) => s.revenueCents),
  )

  const thresholdPct = Math.min(
    100,
    (summary.payableCents / Math.max(1, summary.payoutThresholdCents)) * 100,
  )
  const thresholdMet = summary.payableCents >= summary.payoutThresholdCents

  return (
    <ScrollArea className="wewed-scroll h-full overflow-y-auto">
      <div className="space-y-6 p-4 sm:p-6">
        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {cards.map((c, idx) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.04 }}
            >
              <Card className="h-full border-gold/15 bg-champagne/[0.04] backdrop-blur-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <span
                      className={`inline-flex size-7 items-center justify-center rounded-md bg-champagne/5 ring-1 ring-gold/15 ${c.tint}`}
                    >
                      {c.icon}
                    </span>
                  </div>
                  <p
                    className={`wewed-heading mt-3 font-mono text-2xl ${c.tint}`}
                  >
                    {fmtMoney(c.value, summary.currency)}
                  </p>
                  <p className="mt-1 font-sans text-[11px] font-medium uppercase tracking-wider text-champagne/75">
                    {c.label}
                  </p>
                  {c.hint && (
                    <p className="mt-0.5 font-sans text-[10px] text-champagne/45">
                      {c.hint}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Revenue source breakdown */}
          <Card className="border-gold/15 bg-champagne/[0.04] lg:col-span-2">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="wewed-heading text-lg text-champagne">
                    Revenue by source
                  </h3>
                  <p className="font-sans text-[11px] text-champagne/55">
                    Qualifying revenue &amp; royalty contribution per category
                  </p>
                </div>
                <Badge className="border-gold/30 bg-gold/10 font-sans text-[10px] uppercase tracking-wider text-gold">
                  5% rate
                </Badge>
              </div>

              {summary.bySource.length === 0 ? (
                <EmptyMini
                  icon={<TrendingUp className="size-5" />}
                  title="No revenue yet"
                  body="Qualifying transactions will appear here once your Forever Page starts generating partner bookings."
                />
              ) : (
                <div className="space-y-3">
                  {summary.bySource.map((s) => {
                    const meta = CATEGORY_META[s.source]
                    const pct = (s.revenueCents / maxSourceRevenue) * 100
                    return (
                      <div key={s.source}>
                        <div className="mb-1 flex items-center justify-between font-sans text-xs">
                          <span className="flex items-center gap-2 text-champagne/80">
                            <span className="text-gold">{meta.icon}</span>
                            {meta.label}
                          </span>
                          <span className="font-mono text-champagne/60">
                            {fmtMoney(s.revenueCents, summary.currency)}
                            <span className="ml-2 text-gold-light">
                              +{fmtMoney(s.royaltyCents, summary.currency)}
                            </span>
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-champagne/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }}
                            className="h-full rounded-full bg-gradient-to-r from-gold-muted via-gold to-gold-light"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next settlement + threshold */}
          <div className="space-y-4">
            <Card className="border-gold/15 bg-champagne/[0.04]">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-champagne/60">
                  <CalendarClock className="size-4 text-gold" />
                  <span className="font-sans text-[11px] uppercase tracking-wider">
                    Next settlement
                  </span>
                </div>
                <p className="wewed-heading mt-2 text-2xl text-champagne">
                  {fmtDate(summary.nextSettlementAt)}
                </p>
                <p className="mt-1 font-sans text-[11px] text-champagne/50">
                  Confirmed lines become payable at quarterly settlement.
                </p>
              </CardContent>
            </Card>

            <Card className="border-gold/15 bg-champagne/[0.04]">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-champagne/60">
                    <Wallet className="size-4 text-gold" />
                    <span className="font-sans text-[11px] uppercase tracking-wider">
                      Payout threshold
                    </span>
                  </div>
                  <Badge
                    className={
                      thresholdMet
                        ? 'border-emerald-500/30 bg-emerald-500/10 font-sans text-[10px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/15'
                        : 'border-gold/30 bg-gold/10 font-sans text-[10px] uppercase tracking-wider text-gold hover:bg-gold/15'
                    }
                  >
                    {thresholdMet ? 'Threshold met' : 'Below threshold'}
                  </Badge>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="wewed-heading font-mono text-2xl text-emerald-400">
                    {fmtMoney(summary.payableCents, summary.currency)}
                  </span>
                  <span className="font-sans text-[11px] text-champagne/55">
                    of {fmtMoney(summary.payoutThresholdCents, summary.currency)}
                  </span>
                </div>
                <Progress
                  value={thresholdPct}
                  className="mt-3 h-2 bg-champagne/10 [&>div]:bg-gradient-to-r [&>div]:from-gold [&>div]:to-emerald-400"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tagline footer */}
        <div className="flex items-center justify-center gap-2 pt-2 font-sans text-[11px] italic text-champagne/45">
          <Sparkles className="size-3 text-gold" />
          Your wedding creates value. We share it with you.
        </div>
      </div>
    </ScrollArea>
  )
}

/* ============================================================
   Sub-tab 2: Earnings (Ledger)
   ============================================================ */

function EarningsTab() {
  const { toast } = useToast()
  const [entries, setEntries] = React.useState<LedgerEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<RoyaltyStatus | 'all'>('all')
  const [sourceFilter, setSourceFilter] = React.useState<SourceType | 'all'>('all')
  const [fromDate, setFromDate] = React.useState('')
  const [toDate, setToDate] = React.useState('')
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (sourceFilter !== 'all') params.set('source', sourceFilter)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)
      const qs = params.toString()
      const data = await fetchJson<LedgerEntry[]>(
        `/api/royalty/ledger${qs ? `?${qs}` : ''}`,
      )
      setEntries(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load ledger.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, sourceFilter, fromDate, toDate])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleExportCsv = () => {
    if (entries.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Adjust filters or wait for ledger entries.',
      })
      return
    }
    const header = [
      'Date',
      'Source',
      'Description',
      'Platform Revenue',
      'Qualifying Revenue',
      'Rate (bps)',
      'Royalty',
      'Status',
      'Partner Ref',
    ]
    const rows = entries.map((e) => [
      fmtDate(e.date),
      sourceLabel(e.source),
      e.description,
      (e.platformRevenueCents / 100).toFixed(2),
      (e.qualifyingRevenueCents / 100).toFixed(2),
      String(e.rateBps),
      (e.royaltyCents / 100).toFixed(2),
      e.status,
      e.partnerRef ?? '',
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wewed-royalty-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({
      title: 'CSV exported',
      description: `${entries.length} ledger entries downloaded.`,
    })
  }

  if (loading) return <TabSkeleton />
  if (error) return <ErrorBlock message={error} onRetry={load} />

  const totalRoyalty = entries.reduce((sum, e) => sum + e.royaltyCents, 0)

  return (
    <ScrollArea className="wewed-scroll h-full overflow-y-auto">
      <div className="space-y-4 p-4 sm:p-6">
        {/* Filter bar */}
        <Card className="border-gold/15 bg-champagne/[0.04]">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FilterField label="Status">
                  <Select
                    value={statusFilter}
                    onValueChange={(v) =>
                      setStatusFilter(v as RoyaltyStatus | 'all')
                    }
                  >
                    <SelectTrigger className="w-full border-gold/25 bg-espresso/40 text-champagne">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent className="border-gold/25 bg-espresso text-champagne">
                      <SelectItem value="all">All statuses</SelectItem>
                      {(Object.keys(STATUS_META) as RoyaltyStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="Source">
                  <Select
                    value={sourceFilter}
                    onValueChange={(v) =>
                      setSourceFilter(v as SourceType | 'all')
                    }
                  >
                    <SelectTrigger className="w-full border-gold/25 bg-espresso/40 text-champagne">
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent className="border-gold/25 bg-espresso text-champagne">
                      <SelectItem value="all">All sources</SelectItem>
                      {(Object.keys(CATEGORY_META) as SourceType[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {CATEGORY_META[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterField>
                <FilterField label="From">
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="border-gold/25 bg-espresso/40 text-champagne"
                  />
                </FilterField>
                <FilterField label="To">
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="border-gold/25 bg-espresso/40 text-champagne"
                  />
                </FilterField>
              </div>
              <Button
                onClick={handleExportCsv}
                variant="outline"
                className="gap-2 border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:text-gold-light"
              >
                <Download className="size-4" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Ledger table */}
        <Card className="border-gold/15 bg-champagne/[0.02]">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-gold/15 px-4 py-3">
              <div>
                <h3 className="wewed-heading text-base text-champagne">
                  Ledger entries
                </h3>
                <p className="font-sans text-[11px] text-champagne/50">
                  {entries.length} {entries.length === 1 ? 'entry' : 'entries'} ·{' '}
                  <span className="font-mono text-gold-light">
                    {fmtMoney(totalRoyalty)}
                  </span>{' '}
                  total royalty
                </p>
              </div>
            </div>

            {entries.length === 0 ? (
              <EmptyMini
                icon={<Receipt className="size-5" />}
                title="No entries match your filters"
                body="Try widening the date range or selecting 'All statuses'."
              />
            ) : (
              <div className="max-h-[60vh] overflow-auto wewed-scroll">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gold/15 hover:bg-transparent">
                      <TableHead className="w-8" />
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Date
                      </TableHead>
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Source
                      </TableHead>
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Description
                      </TableHead>
                      <TableHead className="text-right font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Platform Rev.
                      </TableHead>
                      <TableHead className="text-right font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Qualifying Rev.
                      </TableHead>
                      <TableHead className="text-right font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Rate
                      </TableHead>
                      <TableHead className="text-right font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Royalty
                      </TableHead>
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((e) => {
                      const meta = STATUS_META[e.status]
                      const isExpanded = expandedId === e.id
                      return (
                        <React.Fragment key={e.id}>
                          <TableRow
                            onClick={() =>
                              setExpandedId(isExpanded ? null : e.id)
                            }
                            className="cursor-pointer border-gold/10 transition-colors hover:bg-gold/[0.04] data-[state=selected]:bg-gold/[0.06]"
                          >
                            <TableCell className="text-champagne/40">
                              {isExpanded ? (
                                <ChevronDown className="size-3.5" />
                              ) : (
                                <ChevronRight className="size-3.5" />
                              )}
                            </TableCell>
                            <TableCell className="font-sans text-xs text-champagne/75">
                              {fmtDate(e.date)}
                            </TableCell>
                            <TableCell>
                              <Badge className="border-gold/20 bg-gold/5 font-sans text-[10px] text-gold-light hover:bg-gold/10">
                                {CATEGORY_META[e.source].icon}
                                <span className="ml-1">
                                  {sourceLabel(e.source)}
                                </span>
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate font-sans text-xs text-champagne/85">
                              {e.description}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-champagne/60">
                              {fmtMoney(e.platformRevenueCents)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-champagne/75">
                              {fmtMoney(e.qualifyingRevenueCents)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-champagne/55">
                              {(e.rateBps / 100).toFixed(2)}%
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-medium text-gold-light">
                              {fmtMoney(e.royaltyCents)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`gap-1 font-sans text-[10px] ${meta.className}`}
                              >
                                <span className={`size-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="border-gold/10 bg-espresso/40 hover:bg-espresso/40">
                              <TableCell colSpan={9} className="px-8 py-4">
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="grid gap-3 sm:grid-cols-3"
                                >
                                  <DetailItem
                                    label="Entry ID"
                                    value={
                                      <span className="font-mono">{e.id}</span>
                                    }
                                  />
                                  <DetailItem
                                    label="Partner reference"
                                    value={
                                      e.partnerRef ? (
                                        <span className="font-mono">
                                          {e.partnerRef}
                                        </span>
                                      ) : (
                                        '—'
                                      )
                                    }
                                  />
                                  <DetailItem
                                    label="Guest reference"
                                    value={
                                      e.guestRef ? (
                                        <span className="font-mono">
                                          {e.guestRef}
                                        </span>
                                      ) : (
                                        '—'
                                      )
                                    }
                                  />
                                  {e.notes && (
                                    <DetailItem
                                      label="Notes"
                                      value={
                                        <span className="font-sans text-xs text-champagne/70">
                                          {e.notes}
                                        </span>
                                      }
                                      full
                                    />
                                  )}
                                  <DetailItem
                                    label="Calculation"
                                    value={
                                      <span className="font-mono text-xs text-champagne/75">
                                        {fmtMoney(e.qualifyingRevenueCents)} ×{' '}
                                        {(e.rateBps / 100).toFixed(2)}% ={' '}
                                        <span className="text-gold-light">
                                          {fmtMoney(e.royaltyCents)}
                                        </span>
                                      </span>
                                    }
                                    full
                                  />
                                </motion.div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}

function FilterField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-sans text-[10px] uppercase tracking-wider text-champagne/55">
        {label}
      </span>
      {children}
    </label>
  )
}

function DetailItem({
  label,
  value,
  full,
}: {
  label: string
  value: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-3' : ''}>
      <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/45">
        {label}
      </p>
      <p className="mt-0.5 text-xs text-champagne/85">{value}</p>
    </div>
  )
}

/* ============================================================
   Sub-tab 3: Partners (Monetisation preferences)
   ============================================================ */

function PartnersTab({ onEnable }: { onEnable: () => void }) {
  const { toast } = useToast()
  const [categories, setCategories] = React.useState<MonetisationCategory[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [enrolled, setEnrolled] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchJson<{
        enrolled: boolean
        categories: MonetisationCategory[]
      }>('/api/royalty/preferences')
      setEnrolled(data.enrolled)
      setCategories(
        Array.isArray(data.categories) && data.categories.length > 0
          ? data.categories
          : defaultCategories(),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load preferences.')
      setCategories(defaultCategories())
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleToggle = async (key: SourceType, next: boolean) => {
    setCategories((prev) =>
      prev.map((c) => (c.key === key ? { ...c, enabled: next } : c)),
    )
    try {
      await fetch('/api/royalty/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: key, enabled: next }),
      })
      toast({
        title: next ? 'Category enabled' : 'Category disabled',
        description: `${sourceLabel(key)} ${next ? 'will earn' : 'will no longer earn'} royalty.`,
      })
    } catch (err) {
      // revert on failure
      setCategories((prev) =>
        prev.map((c) => (c.key === key ? { ...c, enabled: !next } : c)),
      )
      toast({
        title: 'Unable to update preference',
        description: err instanceof Error ? err.message : 'Try again later.',
        variant: 'destructive',
      })
    }
  }

  if (loading) return <TabSkeleton />
  if (error) return <ErrorBlock message={error} onRetry={load} />

  if (!enrolled) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md border-gold/20 bg-champagne/[0.04]">
          <CardContent className="p-6 text-center">
            <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/30">
              <Crown className="size-6 text-gold" />
            </div>
            <h3 className="wewed-heading text-xl text-champagne">
              Royalty not enabled
            </h3>
            <p className="mt-2 font-sans text-sm text-champagne/65">
              Enable wewed Royalty to manage which monetisation categories
              contribute to your earnings.
            </p>
            <Button
              onClick={onEnable}
              className="mt-4 gap-2 bg-gold text-espresso hover:bg-gold-light"
            >
              <Sparkles className="size-4" />
              Enable wewed Royalty
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const enabledCount = categories.filter((c) => c.enabled).length

  return (
    <ScrollArea className="wewed-scroll h-full overflow-y-auto">
      <div className="space-y-4 p-4 sm:p-6">
        {/* Programme status */}
        <Card className="border-gold/15 bg-champagne/[0.04]">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <Check className="size-5 text-emerald-400" />
              </span>
              <div>
                <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                  Programme status
                </p>
                <p className="wewed-heading text-lg text-champagne">
                  Enrolled &amp; active
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 font-sans text-[11px] text-champagne/65">
              <div className="text-right">
                <p className="font-mono text-lg text-gold-light">
                  {enabledCount}/{categories.length}
                </p>
                <p className="text-[10px] uppercase tracking-wider">
                  Categories enabled
                </p>
              </div>
              <Separator orientation="vertical" className="h-10 bg-gold/20" />
              <div className="text-right">
                <p className="font-mono text-lg text-gold-light">5.00%</p>
                <p className="text-[10px] uppercase tracking-wider">
                  Royalty rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Categories grid */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => (
            <Card
              key={c.key}
              className={`border-gold/15 transition-colors ${
                c.enabled
                  ? 'bg-champagne/[0.06]'
                  : 'bg-champagne/[0.02]'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex size-9 items-center justify-center rounded-md ring-1 ${
                        c.enabled
                          ? 'bg-gold/10 text-gold ring-gold/30'
                          : 'bg-champagne/5 text-champagne/40 ring-gold/10'
                      }`}
                    >
                      {c.icon}
                    </span>
                    <div>
                      <p className="wewed-heading text-base text-champagne">
                        {c.label}
                      </p>
                      <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/45">
                        {c.approvedPartners} approved partners
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={c.enabled}
                    onCheckedChange={(v) => handleToggle(c.key, v)}
                    aria-label={`Toggle ${c.label}`}
                  />
                </div>
                <Separator className="my-3 bg-gold/10" />
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 size-3 shrink-0 text-gold-muted" />
                  <p className="font-sans text-[11px] leading-relaxed text-champagne/55">
                    {c.placementRules}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge
                    className={
                      c.enabled
                        ? 'border-emerald-500/30 bg-emerald-500/10 font-sans text-[10px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/15'
                        : 'border-champagne/15 bg-champagne/5 font-sans text-[10px] uppercase tracking-wider text-champagne/45 hover:bg-champagne/10'
                    }
                  >
                    {c.enabled ? 'Earning' : 'Paused'}
                  </Badge>
                  <span className="font-sans text-[10px] text-champagne/40">
                    {c.enabled ? 'Royalty accrues' : 'No royalty'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 pt-2 font-sans text-[11px] text-champagne/45">
          <ShieldCheck className="size-3 text-sage-light" />
          Toggle categories anytime. Changes apply to new transactions only.
        </div>
      </div>
    </ScrollArea>
  )
}

function defaultCategories(): MonetisationCategory[] {
  return [
    {
      key: 'venue',
      label: 'Venue',
      enabled: true,
      approvedPartners: 4,
      placementRules:
        'Featured venue card on your Forever Page + travel & stay section. Earns on confirmed bookings.',
      icon: <Building2 className="size-4" />,
    },
    {
      key: 'vendors',
      label: 'Vendors',
      enabled: true,
      approvedPartners: 18,
      placementRules:
        'Categorized vendor marketplace widget visible to guests. Earns on completed service bookings.',
      icon: <ShoppingBag className="size-4" />,
    },
    {
      key: 'travel',
      label: 'Travel',
      enabled: true,
      approvedPartners: 7,
      placementRules:
        'Travel partner cards on the travel & stay section. Earns on hotel + shuttle bookings.',
      icon: <Plane className="size-4" />,
    },
    {
      key: 'merchandise',
      label: 'Merchandise',
      enabled: true,
      approvedPartners: 3,
      placementRules:
        'wewed store merch shelf on Forever Page + AFTER keepsakes. Earns on every order.',
      icon: <Gift className="size-4" />,
    },
    {
      key: 'advertising',
      label: 'Advertising',
      enabled: false,
      approvedPartners: 0,
      placementRules:
        'Subtle, opt-in sponsor placements on the public Forever Page. Off by default.',
      icon: <Megaphone className="size-4" />,
    },
    {
      key: 'clothing',
      label: 'Clothing',
      enabled: true,
      approvedPartners: 5,
      placementRules:
        'Bridal party attire + dress-code partner cards. Earns on qualifying apparel orders.',
      icon: <Shirt className="size-4" />,
    },
    {
      key: 'memory_books',
      label: 'Memory Books',
      enabled: true,
      approvedPartners: 2,
      placementRules:
        'Printed photo album & keepsake book offers in the AFTER experience. Earns on every order.',
      icon: <BookOpen className="size-4" />,
    },
    {
      key: 'anniversary',
      label: 'Anniversary',
      enabled: true,
      approvedPartners: 4,
      placementRules:
        'Re-engagement flows on anniversary milestones. Earns on re-orders for life of the Forever Page.',
      icon: <Sparkles className="size-4" />,
    },
    {
      key: 'referrals',
      label: 'Referrals',
      enabled: true,
      approvedPartners: 0,
      placementRules:
        'Other couples who sign up via your referral link. Earns one-time bonus royalty on enrolment.',
      icon: <Users className="size-4" />,
    },
  ]
}

/* ============================================================
   Sub-tab 4: Payouts
   ============================================================ */

function PayoutsTab({ payableCents }: { payableCents: number }) {
  const { toast } = useToast()
  const [accounts, setAccounts] = React.useState<PayoutAccount[]>([])
  const [payouts, setPayouts] = React.useState<PayoutRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)

  const thresholdCents = PAYOUT_THRESHOLD * 100
  const meetsThreshold = payableCents >= thresholdCents
  const thresholdPct = Math.min(100, (payableCents / Math.max(1, thresholdCents)) * 100)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [acctRes, payRes] = await Promise.allSettled([
        fetchJson<PayoutAccount[]>('/api/royalty/payout-account'),
        fetchJson<PayoutRecord[]>('/api/royalty/payout'),
      ])
      setAccounts(
        acctRes.status === 'fulfilled' && Array.isArray(acctRes.value)
          ? acctRes.value
          : [],
      )
      setPayouts(
        payRes.status === 'fulfilled' && Array.isArray(payRes.value)
          ? payRes.value
          : [],
      )
      if (acctRes.status === 'rejected' && payRes.status === 'rejected') {
        throw acctRes.reason
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load payouts.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleRequestPayout = async () => {
    if (!meetsThreshold) return
    try {
      const res = await fetch('/api/royalty/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: payableCents }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `${res.status}`)
      }
      toast({
        title: 'Payout requested',
        description: `${fmtMoney(payableCents)} is on its way to your default account.`,
      })
      void load()
    } catch (err) {
      toast({
        title: 'Payout failed',
        description: err instanceof Error ? err.message : 'Try again later.',
        variant: 'destructive',
      })
    }
  }

  const handleAddAccount = async (data: {
    provider: PayoutAccount['provider']
    identifier: string
  }) => {
    try {
      const res = await fetch('/api/royalty/payout-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `${res.status}`)
      }
      toast({
        title: 'Payout account added',
        description: 'Verification may take 1–2 business days.',
      })
      setAddOpen(false)
      void load()
    } catch (err) {
      toast({
        title: 'Could not add account',
        description: err instanceof Error ? err.message : 'Try again later.',
        variant: 'destructive',
      })
    }
  }

  if (loading) return <TabSkeleton />
  if (error) return <ErrorBlock message={error} onRetry={load} />

  return (
    <ScrollArea className="wewed-scroll h-full overflow-y-auto">
      <div className="space-y-4 p-4 sm:p-6">
        {/* Payable balance + threshold */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-gold/15 bg-gradient-to-br from-champagne/[0.06] to-champagne/[0.02] lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-champagne/55">
                <Wallet className="size-4 text-gold" />
                <span className="font-sans text-[11px] uppercase tracking-wider">
                  Current payable balance
                </span>
              </div>
              <p className="wewed-heading mt-2 font-mono text-4xl text-emerald-400 sm:text-5xl">
                {fmtMoney(payableCents)}
              </p>
              <p className="mt-1 font-sans text-[11px] text-champagne/50">
                Eligible for payout once the threshold is met.
              </p>

              <div className="mt-5">
                <div className="mb-1 flex items-center justify-between font-sans text-[11px]">
                  <span className="text-champagne/55">Payout threshold</span>
                  <span className="font-mono text-champagne/75">
                    {fmtMoney(payableCents)} / {fmtMoney(thresholdCents)}
                  </span>
                </div>
                <Progress
                  value={thresholdPct}
                  className="h-2.5 bg-champagne/10 [&>div]:bg-gradient-to-r [&>div]:from-gold [&>div]:to-emerald-400"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 font-sans text-[11px] text-champagne/55">
                    {meetsThreshold ? (
                      <>
                        <Check className="size-3 text-emerald-400" />
                        Threshold met — you can request a payout.
                      </>
                    ) : (
                      <>
                        <AlertCircle className="size-3 text-gold" />
                        {fmtMoney(thresholdCents - payableCents)} more to unlock
                        payouts.
                      </>
                    )}
                  </p>
                  <Button
                    onClick={handleRequestPayout}
                    disabled={!meetsThreshold || accounts.filter((a) => a.status === 'active').length === 0}
                    className="gap-2 bg-gold text-espresso hover:bg-gold-light disabled:opacity-40"
                  >
                    <DollarSign className="size-4" />
                    Request Payout
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payout accounts */}
          <Card className="border-gold/15 bg-champagne/[0.04]">
            <CardContent className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-champagne/55">
                  <Building2 className="size-4 text-gold" />
                  <span className="font-sans text-[11px] uppercase tracking-wider">
                    Payout accounts
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddOpen(true)}
                  className="gap-1 border-gold/30 bg-gold/10 px-2 py-1 text-[11px] text-gold hover:bg-gold/20 hover:text-gold-light"
                >
                  <Plus className="size-3" />
                  Add
                </Button>
              </div>

              {accounts.length === 0 ? (
                <div className="rounded-md border border-dashed border-gold/20 px-3 py-6 text-center">
                  <Wallet className="mx-auto size-5 text-champagne/30" />
                  <p className="mt-2 font-sans text-[11px] text-champagne/55">
                    No payout accounts yet.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setAddOpen(true)}
                    className="mt-3 gap-1 bg-gold text-espresso hover:bg-gold-light"
                  >
                    <Plus className="size-3" />
                    Add Payout Account
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {accounts.map((a) => {
                    const sMeta = ACCOUNT_STATUS_META[a.status]
                    return (
                      <div
                        key={a.id}
                        className="rounded-md border border-gold/15 bg-espresso/30 px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-sans text-xs font-medium uppercase tracking-wider text-champagne/85">
                            {a.provider.replace('_', ' ')}
                          </span>
                          {a.isDefault && (
                            <Badge className="border-gold/30 bg-gold/10 px-1.5 py-0 font-sans text-[9px] uppercase tracking-wider text-gold">
                              Default
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-xs text-champagne/70">
                          {a.maskedIdentifier}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={`font-sans text-[9px] uppercase tracking-wider ${sMeta.className}`}
                          >
                            {sMeta.label}
                          </Badge>
                          <span className="font-sans text-[10px] text-champagne/40">
                            {a.displayName}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payout history */}
        <Card className="border-gold/15 bg-champagne/[0.02]">
          <CardContent className="p-0">
            <div className="border-b border-gold/15 px-4 py-3">
              <h3 className="wewed-heading text-base text-champagne">
                Payout history
              </h3>
              <p className="font-sans text-[11px] text-champagne/50">
                {payouts.length} {payouts.length === 1 ? 'payout' : 'payouts'}{' '}
                requested
              </p>
            </div>

            {payouts.length === 0 ? (
              <EmptyMini
                icon={<Wallet className="size-5" />}
                title="No payouts yet"
                body="Once your payable balance meets the threshold, request a payout and it will appear here."
              />
            ) : (
              <div className="max-h-[40vh] overflow-auto wewed-scroll">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gold/15 hover:bg-transparent">
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Requested
                      </TableHead>
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Provider
                      </TableHead>
                      <TableHead className="text-right font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Amount
                      </TableHead>
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Status
                      </TableHead>
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Reference
                      </TableHead>
                      <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                        Completed
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((p) => {
                      const meta = PAYOUT_STATUS_META[p.status]
                      return (
                        <TableRow
                          key={p.id}
                          className="border-gold/10 hover:bg-gold/[0.04]"
                        >
                          <TableCell className="font-sans text-xs text-champagne/75">
                            {fmtDateTime(p.requestedAt)}
                          </TableCell>
                          <TableCell className="font-sans text-xs uppercase tracking-wider text-champagne/65">
                            {p.provider}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium text-emerald-400">
                            {fmtMoney(p.amountCents)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`font-sans text-[10px] ${meta.className}`}
                            >
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-champagne/55">
                            {p.reference ?? '—'}
                          </TableCell>
                          <TableCell className="font-sans text-xs text-champagne/55">
                            {fmtDateTime(p.completedAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddPayoutAccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSubmit={handleAddAccount}
      />
    </ScrollArea>
  )
}

function AddPayoutAccountDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (data: { provider: PayoutAccount['provider']; identifier: string }) => void
}) {
  const [provider, setProvider] = React.useState<PayoutAccount['provider']>('stripe')
  const [identifier, setIdentifier] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) {
      setProvider('stripe')
      setIdentifier('')
      setSubmitting(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) return
    setSubmitting(true)
    onSubmit({ provider, identifier: identifier.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-gold/30 bg-champagne p-0 sm:max-w-md">
        <DialogTitle className="sr-only">Add payout account</DialogTitle>
        <DialogDescription className="sr-only">
          Connect a Stripe, PayPal, bank, or mobile money account to receive
          royalty payouts.
        </DialogDescription>
        <div className="border-b border-gold/20 bg-espresso px-5 py-4 text-champagne">
          <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-gold">
            Payouts
          </p>
          <h2 className="wewed-heading mt-1 text-xl">Add payout account</h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1 block font-sans text-[10px] uppercase tracking-wider text-espresso/60">
              Provider
            </span>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as PayoutAccount['provider'])}
            >
              <SelectTrigger className="w-full border-gold/30 bg-white/60 text-espresso">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-gold/30 bg-white text-espresso">
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
                <SelectItem value="bank">Bank Transfer</SelectItem>
                <SelectItem value="mobile_money">Mobile Money</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block font-sans text-[10px] uppercase tracking-wider text-espresso/60">
              Account identifier
            </span>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder={
                provider === 'stripe'
                  ? 'acct_1A2b3C...'
                  : provider === 'paypal'
                    ? 'you@email.com'
                    : provider === 'bank'
                      ? 'IBAN or last 4 of account'
                      : '+263 7X XXX XXXX'
              }
              className="border-gold/30 bg-white/60 text-espresso"
            />
            <p className="mt-1 flex items-center gap-1 font-sans text-[10px] text-espresso/45">
              <Lock className="size-3" />
              Encrypted at rest. We never display the full identifier.
            </p>
          </label>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="font-sans text-xs text-espresso/70 hover:bg-espresso/5"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !identifier.trim()}
              className="gap-2 bg-espresso text-champagne hover:bg-espresso/90"
            >
              {submitting && <Loader2 className="size-3.5 animate-spin" />}
              Add Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ============================================================
   Sub-tab 5: Statements
   ============================================================ */

function StatementsTab() {
  const { toast } = useToast()
  const today = new Date().toISOString().slice(0, 10)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  const startStr = startOfMonth.toISOString().slice(0, 10)

  const [filters, setFilters] = React.useState<StatementFilters>({
    from: startStr,
    to: today,
    source: 'all',
    status: 'all',
  })
  const [entries, setEntries] = React.useState<LedgerEntry[]>([])
  const [loading, setLoading] = React.useState(false)
  const [generated, setGenerated] = React.useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: filters.from,
        to: filters.to,
      })
      if (filters.source !== 'all') params.set('source', filters.source)
      if (filters.status !== 'all') params.set('status', filters.status)
      const data = await fetchJson<LedgerEntry[]>(
        `/api/royalty/ledger?${params.toString()}`,
      )
      setEntries(Array.isArray(data) ? data : [])
      setGenerated(true)
    } catch (err) {
      toast({
        title: 'Unable to generate statement',
        description: err instanceof Error ? err.message : 'Try again later.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportCsv = () => {
    if (entries.length === 0) return
    const header = ['Date', 'Source', 'Description', 'Royalty', 'Status']
    const rows = entries.map((e) => [
      fmtDate(e.date),
      sourceLabel(e.source),
      e.description,
      (e.royaltyCents / 100).toFixed(2),
      e.status,
    ])
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wewed-royalty-statement-${filters.from}-to-${filters.to}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast({ title: 'Statement exported' })
  }

  const totalRoyalty = entries.reduce((s, e) => s + e.royaltyCents, 0)
  const qualifyingRevenue = entries.reduce(
    (s, e) => s + e.qualifyingRevenueCents,
    0,
  )
  const reversed = entries.filter((e) => e.status === 'reversed').length

  return (
    <ScrollArea className="wewed-scroll h-full overflow-y-auto">
      <div className="space-y-4 p-4 sm:p-6">
        {/* Filters */}
        <Card className="border-gold/15 bg-champagne/[0.04]">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 text-champagne/65">
              <FileText className="size-4 text-gold" />
              <h3 className="wewed-heading text-base text-champagne">
                Statement builder
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterField label="From">
                <Input
                  type="date"
                  value={filters.from}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, from: e.target.value }))
                  }
                  className="border-gold/25 bg-espresso/40 text-champagne"
                />
              </FilterField>
              <FilterField label="To">
                <Input
                  type="date"
                  value={filters.to}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, to: e.target.value }))
                  }
                  className="border-gold/25 bg-espresso/40 text-champagne"
                />
              </FilterField>
              <FilterField label="Source">
                <Select
                  value={filters.source}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      source: v as SourceType | 'all',
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-gold/25 bg-espresso/40 text-champagne">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gold/25 bg-espresso text-champagne">
                    <SelectItem value="all">All sources</SelectItem>
                    {(Object.keys(CATEGORY_META) as SourceType[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {CATEGORY_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Status">
                <Select
                  value={filters.status}
                  onValueChange={(v) =>
                    setFilters((f) => ({
                      ...f,
                      status: v as RoyaltyStatus | 'all',
                    }))
                  }
                >
                  <SelectTrigger className="w-full border-gold/25 bg-espresso/40 text-champagne">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-gold/25 bg-espresso text-champagne">
                    <SelectItem value="all">All statuses</SelectItem>
                    {(Object.keys(STATUS_META) as RoyaltyStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button
                onClick={handleExportCsv}
                disabled={!generated || entries.length === 0}
                variant="outline"
                className="gap-2 border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:text-gold-light disabled:opacity-40"
              >
                <Download className="size-4" />
                Export CSV
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="gap-2 bg-gold text-espresso hover:bg-gold-light"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                Generate Statement
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Statement preview */}
        {generated && (
          <Card className="border-gold/20 bg-champagne/[0.04]">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
                <div>
                  <p className="wewed-monogram text-[10px] uppercase tracking-[0.32em] text-gold">
                    wewed Royalty · Statement
                  </p>
                  <h3 className="wewed-heading mt-1 text-xl text-champagne">
                    {fmtDate(filters.from)} — {fmtDate(filters.to)}
                  </h3>
                </div>
                <Button
                  onClick={() => window.print()}
                  variant="ghost"
                  className="gap-2 text-champagne/60 hover:bg-champagne/5 hover:text-champagne"
                >
                  <Printer className="size-4" />
                  Print
                </Button>
              </div>

              {/* Summary tiles */}
              <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
                <StatementTile
                  label="Qualifying revenue"
                  value={fmtMoney(qualifyingRevenue)}
                  tint="text-champagne/85"
                />
                <StatementTile
                  label="Royalty earned"
                  value={fmtMoney(totalRoyalty)}
                  tint="text-gold-light"
                />
                <StatementTile
                  label="Entries"
                  value={`${entries.length}${reversed > 0 ? ` · ${reversed} reversed` : ''}`}
                  tint="text-champagne/70"
                />
              </div>

              <Separator className="bg-gold/15" />

              {/* Entries list */}
              {entries.length === 0 ? (
                <EmptyMini
                  icon={<FileText className="size-5" />}
                  title="No entries in this range"
                  body="Try a wider date range or different filters."
                />
              ) : (
                <div className="max-h-[45vh] overflow-auto wewed-scroll">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gold/15 hover:bg-transparent">
                        <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                          Date
                        </TableHead>
                        <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                          Source
                        </TableHead>
                        <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                          Description
                        </TableHead>
                        <TableHead className="text-right font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                          Royalty
                        </TableHead>
                        <TableHead className="font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                          Status
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entries.map((e) => {
                        const meta = STATUS_META[e.status]
                        return (
                          <TableRow
                            key={e.id}
                            className="border-gold/10 hover:bg-gold/[0.04]"
                          >
                            <TableCell className="font-sans text-xs text-champagne/75">
                              {fmtDate(e.date)}
                            </TableCell>
                            <TableCell className="font-sans text-xs text-champagne/65">
                              {sourceLabel(e.source)}
                            </TableCell>
                            <TableCell className="max-w-[260px] truncate font-sans text-xs text-champagne/85">
                              {e.description}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-medium text-gold-light">
                              {fmtMoney(e.royaltyCents)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`gap-1 font-sans text-[10px] ${meta.className}`}
                              >
                                <span className={`size-1.5 rounded-full ${meta.dot}`} />
                                {meta.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="border-t border-gold/15 px-5 py-3">
                <div className="flex items-center justify-between font-sans text-xs">
                  <span className="text-champagne/55">Total royalty</span>
                  <span className="font-mono text-base text-gold-light">
                    {fmtMoney(totalRoyalty)}
                  </span>
                </div>
                <p className="mt-2 flex items-center justify-center gap-1.5 font-sans text-[10px] text-champagne/40">
                  <Lock className="size-3" />
                  Generated {fmtDateTime(new Date().toISOString())} · wewed
                  Royalty Programme v1.0.0
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  )
}

function StatementTile({
  label,
  value,
  tint,
}: {
  label: string
  value: string
  tint: string
}) {
  return (
    <div className="rounded-md border border-gold/15 bg-espresso/30 px-3 py-2.5">
      <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/45">
        {label}
      </p>
      <p className={`wewed-heading mt-0.5 font-mono text-lg ${tint}`}>{value}</p>
    </div>
  )
}

/* ============================================================
   Sub-tab 6: Settings
   ============================================================ */

function SettingsTab({
  summary,
  onChanged,
}: {
  summary: RoyaltySummary | null
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [confirmDisable, setConfirmDisable] = React.useState(false)
  const [disabling, setDisabling] = React.useState(false)
  const [audit, setAudit] = React.useState<AuditEvent[]>([])
  const [auditLoading, setAuditLoading] = React.useState(true)

  const loadAudit = React.useCallback(async () => {
    setAuditLoading(true)
    try {
      const data = await fetchJson<AuditEvent[]>('/api/royalty?scope=audit')
      setAudit(Array.isArray(data) ? data : [])
    } catch {
      setAudit([])
    } finally {
      setAuditLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadAudit()
  }, [loadAudit])

  const handleDisable = async () => {
    setDisabling(true)
    try {
      const res = await fetch('/api/royalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable' }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `${res.status}`)
      }
      toast({
        title: 'Monetisation disabled',
        description:
          'Your Forever Page will no longer earn new royalty. Existing balances remain payable.',
      })
      setConfirmDisable(false)
      onChanged()
      void loadAudit()
    } catch (err) {
      toast({
        title: 'Could not disable',
        description: err instanceof Error ? err.message : 'Try again later.',
        variant: 'destructive',
      })
    } finally {
      setDisabling(false)
    }
  }

  return (
    <ScrollArea className="wewed-scroll h-full overflow-y-auto">
      <div className="space-y-4 p-4 sm:p-6">
        {/* Programme status */}
        <Card className="border-gold/15 bg-champagne/[0.04]">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2 text-champagne/65">
              <SettingsIcon className="size-4 text-gold" />
              <h3 className="wewed-heading text-base text-champagne">
                Programme
              </h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SettingsItem
                label="Status"
                value={
                  <Badge className="border-emerald-500/30 bg-emerald-500/10 font-sans text-[10px] uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/15">
                    <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-400" />
                    Enrolled
                  </Badge>
                }
              />
              <SettingsItem
                label="Terms version"
                value={
                  <span className="font-mono text-champagne/85">
                    {summary?.termsVersion ?? '1.0.0'}
                  </span>
                }
              />
              <SettingsItem
                label="Accepted at"
                value={
                  <span className="font-sans text-xs text-champagne/70">
                    {fmtDateTime(summary?.termsAcceptedAt ?? null)}
                  </span>
                }
              />
              <SettingsItem
                label="Royalty rate"
                value={
                  <span className="font-mono text-gold-light">
                    {(summary?.rateBps ?? ROYALTY_RATE_BPS) / 100}%
                    <span className="ml-1 font-sans text-[10px] text-champagne/45">
                      ({summary?.rateBps ?? ROYALTY_RATE_BPS} bps)
                    </span>
                  </span>
                }
              />
              <SettingsItem
                label="Attribution window"
                value={
                  <span className="font-sans text-xs text-champagne/70">
                    {summary?.attributionWindowDays ?? 30} days · first-party
                    cookie
                  </span>
                }
              />
              <SettingsItem
                label="Payout threshold"
                value={
                  <span className="font-mono text-champagne/85">
                    {fmtMoney(summary?.payoutThresholdCents ?? PAYOUT_THRESHOLD * 100)}
                  </span>
                }
              />
            </div>

            <Separator className="my-4 bg-gold/15" />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-1.5 font-sans text-[11px] text-champagne/55">
                <Info className="mt-0.5 size-3 text-gold-muted" />
                Disabling monetisation pauses new royalty accrual. Existing
                confirmed &amp; payable balances remain eligible for payout.
              </p>
              <Button
                onClick={() => setConfirmDisable(true)}
                variant="outline"
                className="gap-2 border-clay/40 bg-clay/10 text-clay-light hover:bg-clay/20 hover:text-clay-light"
              >
                <X className="size-4" />
                Disable Monetisation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calculation help */}
        <Card className="border-gold/15 bg-champagne/[0.04]">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2 text-champagne/65">
              <Receipt className="size-4 text-gold" />
              <h3 className="wewed-heading text-base text-champagne">
                How royalty is calculated
              </h3>
            </div>
            <div className="space-y-2 font-sans text-xs leading-relaxed text-champagne/70">
              <p>
                <span className="text-gold-light">Royalty</span> ={' '}
                <span className="text-champagne/85">Qualifying revenue</span> ×{' '}
                <span className="text-gold-light">Royalty rate</span>
              </p>
              <div className="overflow-hidden rounded-md border border-gold/20 bg-espresso/40">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-gold/15 px-3 py-2 font-sans text-[10px] uppercase tracking-wider text-champagne/55">
                  <span>Example</span>
                  <span className="text-right">Qualifying rev.</span>
                  <span className="text-right text-gold-light">Royalty</span>
                </div>
                {[
                  { label: 'Venue booking', rev: 300000, roy: 15000 },
                  { label: 'Merchandise order', rev: 42000, roy: 2100 },
                  { label: 'Travel partner', rev: 120000, roy: 6000 },
                ].map((ex) => (
                  <div
                    key={ex.label}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-gold/10 px-3 py-2 text-xs"
                  >
                    <span className="text-champagne/85">{ex.label}</span>
                    <span className="text-right font-mono text-champagne/65">
                      {fmtMoney(ex.rev)}
                    </span>
                    <span className="text-right font-mono text-gold-light">
                      {fmtMoney(ex.roy)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="pt-1 text-[11px] text-champagne/50">
                Refunds and chargebacks create{' '}
                <span className="text-clay-light">reversal</span> lines that
                offset future payable balances — you never owe wewed money.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Activity log */}
        <Card className="border-gold/15 bg-champagne/[0.02]">
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-gold/15 px-4 py-3">
              <div className="flex items-center gap-2 text-champagne/65">
                <History className="size-4 text-gold" />
                <h3 className="wewed-heading text-base text-champagne">
                  Activity log
                </h3>
              </div>
              <span className="font-sans text-[10px] uppercase tracking-wider text-champagne/45">
                Recent audit events
              </span>
            </div>
            {auditLoading ? (
              <div className="flex items-center justify-center px-4 py-8">
                <Loader2 className="size-4 animate-spin text-gold" />
              </div>
            ) : audit.length === 0 ? (
              <EmptyMini
                icon={<History className="size-5" />}
                title="No activity yet"
                body="Audit events will appear here as you and wewed interact with your Royalty programme."
              />
            ) : (
              <div className="max-h-[35vh] divide-y divide-gold/10 overflow-auto wewed-scroll">
                {audit.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-gold/10 text-gold">
                      <Diamond className="size-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-xs text-champagne/85">
                        {ev.description}
                      </p>
                      <p className="mt-0.5 font-sans text-[10px] text-champagne/45">
                        {ev.type} · {ev.actor} · {timeAgo(ev.at)}
                      </p>
                    </div>
                    <span className="font-sans text-[10px] text-champagne/40">
                      {fmtDateTime(ev.at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer help */}
        <div className="flex items-center justify-center gap-1.5 pt-2 font-sans text-[11px] text-champagne/45">
          <ShieldCheck className="size-3 text-sage-light" />
          Need help? Contact{' '}
          <a
            href="/company/contact"
            className="text-gold underline-offset-2 hover:underline"
          >
            Wewed support
          </a>
        </div>
      </div>

      {/* Disable confirmation */}
      <Dialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <DialogContent className="border-clay/30 bg-champagne p-0 sm:max-w-md">
          <DialogTitle className="sr-only">
            Disable Royalty monetisation
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirm disabling the wewed Royalty programme for your wedding.
          </DialogDescription>
          <div className="border-b border-clay/20 bg-espresso px-5 py-4 text-champagne">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-4 text-clay-light" />
              <span className="font-sans text-[10px] uppercase tracking-[0.3em] text-clay-light">
                Confirm
              </span>
            </div>
            <h2 className="wewed-heading mt-1 text-xl">
              Disable Royalty monetisation?
            </h2>
          </div>
          <div className="space-y-4 px-5 py-5">
            <p className="font-sans text-sm leading-relaxed text-espresso/75">
              New royalty will stop accruing immediately. Your existing
              confirmed and payable balances remain eligible for payout. You can
              re-enable anytime.
            </p>
            <div className="rounded-md border border-clay/30 bg-clay/5 px-3 py-2">
              <p className="flex items-start gap-2 font-sans text-xs text-clay-light">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                Pending estimated lines may still confirm or reverse based on
                partner refund windows.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setConfirmDisable(false)}
                className="font-sans text-xs text-espresso/70 hover:bg-espresso/5"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDisable}
                disabled={disabling}
                className="gap-2 bg-clay text-champagne hover:bg-clay-light"
              >
                {disabling && <Loader2 className="size-3.5 animate-spin" />}
                Disable Monetisation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ScrollArea>
  )
}

function SettingsItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-gold/15 bg-espresso/30 px-3 py-2.5">
      <p className="font-sans text-[10px] uppercase tracking-wider text-champagne/45">
        {label}
      </p>
      <div className="mt-1 text-sm text-champagne/85">{value}</div>
    </div>
  )
}

/* ============================================================
   Shared sub-components
   ============================================================ */

function TabSkeleton() {
  return (
    <div className="h-full overflow-hidden p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-lg border border-gold/10 bg-champagne/[0.03]"
          />
        ))}
      </div>
      <div className="mt-4 h-48 animate-pulse rounded-lg border border-gold/10 bg-champagne/[0.03]" />
    </div>
  )
}

function ErrorBlock({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-full bg-clay/15 ring-1 ring-clay/30">
          <AlertCircle className="size-6 text-clay-light" />
        </div>
        <h3 className="wewed-heading text-lg text-champagne">
          Couldn&apos;t load this view
        </h3>
        <p className="mt-1 font-sans text-xs text-champagne/55">{message}</p>
        <Button
          onClick={onRetry}
          variant="outline"
          className="mt-4 gap-2 border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:text-gold-light"
        >
          <Loader2 className="size-3.5" />
          Retry
        </Button>
      </div>
    </div>
  )
}

function EmptyMini({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <span className="inline-flex size-10 items-center justify-center rounded-full bg-champagne/5 text-champagne/30 ring-1 ring-gold/10">
        {icon}
      </span>
      <p className="mt-3 wewed-heading text-sm text-champagne/75">{title}</p>
      <p className="mt-1 max-w-xs font-sans text-[11px] text-champagne/45">
        {body}
      </p>
    </div>
  )
}

export default RoyaltyDashboard
