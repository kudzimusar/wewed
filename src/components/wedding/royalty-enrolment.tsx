'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown,
  Diamond,
  Check,
  X,
  Info,
  Sparkles,
  ShieldCheck,
  Receipt,
  CalendarClock,
  Wallet,
  Lock,
  AlertCircle,
  Loader2,
  Heart,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

/* ============================================================
   wewed Royalty — Enrolment Dialog
   ------------------------------------------------------------
   Shown when a couple clicks "Enable wewed Royalty".
   Walks them through the programme, the 5% calculation, the
   eligible / excluded revenue categories, attribution rules,
   refund & chargeback rules, settlement periods, payout
   threshold, tax notice, and privacy commitment. On accept,
   POST /api/royalty with the terms acceptance payload.
   ============================================================ */

const TERMS_VERSION = '1.0.0'
const ROYALTY_RATE_BPS = 500 // 5.00%
const PAYOUT_THRESHOLD = 25 // USD

const ELIGIBLE_REVENUE = [
  'Vendor bookings made through wewed',
  'Venue referrals that convert',
  'Merchandise sold via the wewed store',
  'Travel partner bookings originating from the wedding page',
  'Memory book & keepsake purchases',
  'Anniversary product re-orders',
  'Approved advertising placements',
]

const EXCLUDED_REVENUE = [
  'RSVP and ceremony management fees',
  'Refunded or chargeback transactions',
  'Direct guest-to-couple cash gifts',
  'Tax & shipping pass-throughs',
  'Affiliate revenue from third-party links',
]

const CALCULATION_EXAMPLES = [
  { label: 'Venue referral', revenue: '$3,000.00', royalty: '$150.00' },
  { label: 'Merchandise order', revenue: '$420.00', royalty: '$21.00' },
  { label: 'Travel booking', revenue: '$1,200.00', royalty: '$60.00' },
]

export interface RoyaltyEnrolmentProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAccepted?: () => void
}

interface AcceptState {
  status: 'idle' | 'submitting' | 'success' | 'error'
  message?: string
}

export function RoyaltyEnrolment({
  open,
  onOpenChange,
  onAccepted,
}: RoyaltyEnrolmentProps) {
  const [accept, setAccept] = React.useState<AcceptState>({ status: 'idle' })
  const [hasScrolled, setHasScrolled] = React.useState(false)

  // Reset whenever the dialog is reopened
  React.useEffect(() => {
    if (open) {
      setAccept({ status: 'idle' })
      setHasScrolled(false)
    }
  }, [open])

  const handleAccept = async () => {
    setAccept({ status: 'submitting' })
    try {
      const res = await fetch('/api/royalty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enrol',
          termsVersion: TERMS_VERSION,
          acceptedAt: new Date().toISOString(),
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `${res.status} ${res.statusText}`)
      }
      setAccept({
        status: 'success',
        message: 'Welcome to wewed Royalty! Your wedding can now earn.',
      })
      onAccepted?.()
    } catch (err) {
      setAccept({
        status: 'error',
        message:
          err instanceof Error ? err.message : 'Unable to enrol. Try again.',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden border-gold/30 bg-champagne p-0 sm:max-w-2xl">
        <DialogTitle className="sr-only">Enable wewed Royalty</DialogTitle>
        <DialogDescription className="sr-only">
          Enrol your wedding in the wewed Royalty programme to begin earning a
          5% share of qualifying platform revenue.
        </DialogDescription>

        <AnimatePresence mode="wait">
          {accept.status === 'success' ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center px-6 py-16 text-center"
            >
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 18 }}
                className="mb-6 inline-flex size-20 items-center justify-center rounded-full bg-gold/15 ring-1 ring-gold/40"
              >
                <Crown className="size-9 text-gold" />
              </motion.div>
              <p className="wewed-monogram text-xs uppercase tracking-[0.3em] text-gold-muted">
                Welcome to wewed Royalty
              </p>
              <h2 className="wewed-heading mt-3 text-3xl text-espresso sm:text-4xl">
                Your wedding can now earn.
              </h2>
              <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-espresso/70">
                Every qualifying booking, every keepsake order, every referral
                that begins with your Forever Page now contributes to your
                Royalty balance. We will notify you when your first earnings
                appear in the ledger.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={() => onOpenChange(false)}
                  className="bg-espresso text-champagne hover:bg-espresso/90"
                >
                  View Royalty Dashboard
                </Button>
              </div>
              <div className="mt-6 flex items-center gap-2 font-sans text-[11px] text-espresso/50">
                <Lock className="size-3" />
                Terms v{TERMS_VERSION} accepted
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex max-h-[92vh] flex-col"
            >
              {/* Header */}
              <div className="relative shrink-0 overflow-hidden border-b border-gold/20 bg-espresso px-6 py-6 text-champagne">
                <div className="absolute inset-0 opacity-30">
                  <div className="absolute -right-12 -top-12 size-48 rounded-full bg-gold/20 blur-3xl" />
                  <div className="absolute -left-12 bottom-0 size-40 rounded-full bg-clay/15 blur-3xl" />
                </div>
                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Crown className="size-4 text-gold" />
                      <span className="font-sans text-[10px] uppercase tracking-[0.32em] text-gold">
                        wewed Royalty
                      </span>
                    </div>
                    <h2 className="wewed-heading mt-2 text-2xl text-champagne sm:text-3xl">
                      Your wedding creates value.
                      <br />
                      <span className="text-gold">We share it with you.</span>
                    </h2>
                    <p className="mt-2 max-w-md font-sans text-xs leading-relaxed text-champagne/60">
                      Couples earn a 5% royalty on qualifying revenue generated
                      through their Forever Page — vendors, travel, merch,
                      memory books and more.
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-gold/40 bg-gold/10 px-2 py-1 font-sans text-[10px] uppercase tracking-wider text-gold-light"
                  >
                    Terms v{TERMS_VERSION}
                  </Badge>
                </div>
              </div>

              {/* Body — scrollable terms */}
              <ScrollArea
                onScroll={(e) => {
                  const el = e.currentTarget
                  if (el.scrollTop > 12) setHasScrolled(true)
                }}
                className="wewed-scroll max-h-[58vh] flex-1 overflow-y-auto bg-champagne/40"
              >
                <div className="space-y-7 px-6 py-6">
                  {/* 5% calculation */}
                  <Section
                    icon={<Receipt className="size-4" />}
                    title="How the 5% is calculated"
                  >
                    <p className="font-sans text-sm leading-relaxed text-espresso/75">
                      For every qualifying transaction originating from your
                      wedding page, wewed retains 95% and routes 5% to your
                      Royalty ledger. Earnings accrue monthly, are confirmed
                      once the partner&apos;s refund window closes (30–60 days),
                      and become payable at the next quarterly settlement.
                    </p>
                    <div className="mt-3 overflow-hidden rounded-lg border border-gold/20 bg-white/60">
                      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 bg-espresso/5 px-4 py-2 font-sans text-[10px] uppercase tracking-wider text-espresso/55">
                        <span>Example</span>
                        <span className="text-right">Revenue</span>
                        <span className="text-right text-gold">Royalty (5%)</span>
                      </div>
                      {CALCULATION_EXAMPLES.map((ex) => (
                        <div
                          key={ex.label}
                          className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-gold/10 px-4 py-2.5 font-sans text-sm text-espresso"
                        >
                          <span>{ex.label}</span>
                          <span className="text-right font-mono text-espresso/75">
                            {ex.revenue}
                          </span>
                          <span className="text-right font-mono font-medium text-gold">
                            {ex.royalty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Section>

                  {/* Eligible revenue */}
                  <Section
                    icon={<Check className="size-4" />}
                    title="Eligible revenue"
                    tint="text-sage-light"
                  >
                    <ul className="space-y-2">
                      {ELIGIBLE_REVENUE.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 font-sans text-sm text-espresso/80"
                        >
                          <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-sage/15 text-sage-light">
                            <Check className="size-3" />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  {/* Excluded revenue */}
                  <Section
                    icon={<X className="size-4" />}
                    title="Excluded revenue"
                    tint="text-clay-light"
                  >
                    <ul className="space-y-2">
                      {EXCLUDED_REVENUE.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2.5 font-sans text-sm text-espresso/75"
                        >
                          <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-clay/15 text-clay-light">
                            <X className="size-3" />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </Section>

                  {/* Attribution */}
                  <Section
                    icon={<Diamond className="size-4" />}
                    title="Attribution window"
                  >
                    <p className="font-sans text-sm leading-relaxed text-espresso/75">
                      A booking is attributed to your wedding when a guest or
                      visitor begins the partner journey from your Forever Page
                      and completes checkout within{' '}
                      <span className="font-medium text-espresso">30 days</span>{' '}
                      on the same device. Returning visitors are matched via a
                      first-party, privacy-preserving cookie that does{' '}
                      <span className="italic">not</span> follow guests off the
                      wewed domain.
                    </p>
                  </Section>

                  {/* Refunds & chargebacks */}
                  <Section
                    icon={<AlertCircle className="size-4" />}
                    title="Refunds & chargebacks"
                    tint="text-clay-light"
                  >
                    <p className="font-sans text-sm leading-relaxed text-espresso/75">
                      If a partner refunds a transaction within their
                      confirmation window, the corresponding royalty line is
                      moved to{' '}
                      <Badge className="ml-1 bg-clay/15 text-clay-light hover:bg-clay/20">
                        reversed
                      </Badge>{' '}
                      in the ledger. Chargebacks are treated identically. You
                      will never owe wewed money — reversals only reduce future
                      payable balance.
                    </p>
                  </Section>

                  {/* Settlement timeline */}
                  <Section
                    icon={<CalendarClock className="size-4" />}
                    title="Settlement timeline"
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      {[
                        {
                          step: '1',
                          title: 'Accrue',
                          body: 'Monthly. Each qualifying transaction enters your ledger as estimated.',
                        },
                        {
                          step: '2',
                          title: 'Confirm',
                          body: '30–60 days. Partner refund window closes; line moves to confirmed.',
                        },
                        {
                          step: '3',
                          title: 'Settle',
                          body: 'Quarterly. Confirmed lines become payable and eligible for payout.',
                        },
                      ].map((s) => (
                        <div
                          key={s.step}
                          className="rounded-lg border border-gold/20 bg-white/60 p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="inline-flex size-5 items-center justify-center rounded-full bg-gold/15 font-serif text-xs text-gold">
                              {s.step}
                            </span>
                            <span className="font-sans text-xs font-semibold uppercase tracking-wider text-espresso">
                              {s.title}
                            </span>
                          </div>
                          <p className="mt-2 font-sans text-xs leading-relaxed text-espresso/70">
                            {s.body}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Section>

                  {/* Payout threshold */}
                  <Section icon={<Wallet className="size-4" />} title="Payout threshold">
                    <div className="flex items-center justify-between rounded-lg border border-gold/20 bg-white/60 px-4 py-3">
                      <div>
                        <p className="font-sans text-xs uppercase tracking-wider text-espresso/55">
                          Minimum payout
                        </p>
                        <p className="font-serif text-2xl text-espresso">
                          ${PAYOUT_THRESHOLD.toFixed(2)}
                          <span className="ml-1 font-sans text-xs text-espresso/50">
                            USD
                          </span>
                        </p>
                      </div>
                      <div className="text-right font-sans text-[11px] leading-relaxed text-espresso/60">
                        Balances below the threshold
                        <br />
                        roll forward to the next cycle.
                      </div>
                    </div>
                  </Section>

                  {/* Tax & privacy */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Callout
                      icon={<Receipt className="size-3.5" />}
                      tone="gold"
                      title="Tax responsibility"
                      body="You are responsible for any tax obligations arising from Royalty payments. wewed does not withhold tax on your behalf."
                    />
                    <Callout
                      icon={<ShieldCheck className="size-3.5" />}
                      tone="sage"
                      title="Privacy commitment"
                      body="We do not sell guest personal data. Royalty attribution is aggregated and never exposes individual guest activity to partners."
                    />
                  </div>

                  <Separator className="bg-gold/20" />

                  <p className="flex items-center justify-center gap-1.5 font-sans text-[11px] text-espresso/50">
                    <Sparkles className="size-3 text-gold" />
                    By accepting, you agree to the wewed Royalty Programme Terms
                    v{TERMS_VERSION}.
                  </p>
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="shrink-0 border-t border-gold/20 bg-champagne px-6 py-4">
                {accept.status === 'error' && (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-clay/30 bg-clay/10 px-3 py-2 font-sans text-xs text-clay-light">
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                    <span>{accept.message}</span>
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-1.5 font-sans text-[11px] text-espresso/55">
                    {hasScrolled ? (
                      <>
                        <Check className="size-3 text-sage-light" />
                        You&apos;ve reviewed the programme terms.
                      </>
                    ) : (
                      <>
                        <Info className="size-3 text-gold-muted" />
                        Scroll to review all terms before accepting.
                      </>
                    )}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => onOpenChange(false)}
                      className="font-sans text-xs text-espresso/70 hover:bg-espresso/5 hover:text-espresso"
                    >
                      Not now
                    </Button>
                    <Button
                      onClick={handleAccept}
                      disabled={accept.status === 'submitting'}
                      className="gap-2 bg-espresso text-champagne hover:bg-espresso/90"
                    >
                      {accept.status === 'submitting' ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Heart className="size-3.5 text-gold" />
                      )}
                      I Accept &amp; Enable wewed Royalty
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function Section({
  icon,
  title,
  children,
  tint = 'text-gold',
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  tint?: string
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className={`inline-flex size-6 items-center justify-center rounded-md bg-white/60 ring-1 ring-gold/20 ${tint}`}>
          {icon}
        </span>
        <h3 className="wewed-heading text-lg text-espresso">{title}</h3>
      </div>
      <div className="pl-8">{children}</div>
    </section>
  )
}

function Callout({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode
  title: string
  body: string
  tone: 'gold' | 'sage' | 'clay'
}) {
  const toneClass = {
    gold: 'border-gold/30 bg-gold/5 text-gold',
    sage: 'border-sage/30 bg-sage/5 text-sage-light',
    clay: 'border-clay/30 bg-clay/5 text-clay-light',
  }[tone]

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <span className="inline-flex size-5 items-center justify-center rounded-md bg-white/70">
          {icon}
        </span>
        <span className="font-sans text-xs font-semibold uppercase tracking-wider">
          {title}
        </span>
      </div>
      <p className="mt-2 font-sans text-xs leading-relaxed text-espresso/75">
        {body}
      </p>
    </div>
  )
}

export default RoyaltyEnrolment
