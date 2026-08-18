'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertTriangle,
  FileCheck2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldCheck,
  Upload,
  WalletCards,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'

type GovernanceFlag = {
  code: string
  severity: 'info' | 'warning' | 'critical'
  message: string
}

type PaymentMilestone = {
  id: string
  milestoneType: string
  label: string
  description: string | null
  amount: number
  currency: string
  dueAt: string | null
  status: string
  sequence: number
  proofRequired: boolean
  recordedNet: number
  outstanding: number
}

type ManagedPayment = {
  id: string
  milestoneId: string | null
  entryType: 'PAYMENT' | 'REFUND' | 'REVERSAL'
  amount: number
  currency: string
  paidAt: string
  method: string | null
  reference: string | null
  notes: string | null
  source: string
  proofRequired: boolean
  proofWaiverReason: string | null
  proofVaultObjectId: string | null
  reversesPaymentId: string | null
  recordNature: string
  wewedProcessorRole: string
  custodyStatus: string
  createdAt: string
}

type LegacyPayment = {
  id: string
  amount: number
  currency: string
  paidAt: string | null
  method: string | null
  reference: string | null
  notes: string | null
  createdAt: string
}

type DisputeIssue = {
  id: string
  clauseReference: string | null
  category: string
  allegationText: string
  status: string
  findingStatus: string
  createdAt: string
}

type DisputeEvent = {
  id: string
  issueId: string | null
  eventType: string
  source: string
  actorId: string
  actorPartyId: string | null
  note: string
  metadata: unknown
  createdAt: string
}

type EvidenceHold = {
  id: string
  vaultObjectId: string
  reason: string
  status: string
  placedById: string
  placedAt: string
  releasedById: string | null
  releasedAt: string | null
  releaseReason: string | null
}

type DisputeOutcome = {
  id: string
  source: string
  outcomeSummary: string
  remedyType: string
  amount: number | null
  currency: string | null
  externalReference: string | null
  evidenceVaultObjectId: string | null
  recordedAt: string
  wewedAdjudicationRole: string
}

type DisputeCase = {
  id: string
  status: string
  summary: string
  openedById: string
  openedAt: string
  closedAt: string | null
  issues: DisputeIssue[]
  events: DisputeEvent[]
  outcome: DisputeOutcome | null
  holds: EvidenceHold[]
}

export type TransactionGovernanceData = {
  engagement: {
    id: string
    weddingId: string
    vendorId: string
    vendorName: string
    serviceCategory: string
    agreedAmount: number | null
    currency: string
    lifecycleStatus: string
  }
  contractCommitment: {
    amount: number | null
    contractId: string | null
    versionId: string | null
    source: string
  }
  reconciliation: {
    budgetCommitted: number
    budgetPaid: number
    legacyPaymentFactsTotal: number
    managedPaymentFactsNet: number
    comparisonPaymentTotal: number
    comparisonSource: string
    milestoneTotal: number
    orphanPaidBudgetItems: number
    flags: GovernanceFlag[]
    budgetMutationPolicy: string
    wewedProcessorRole: string
    custodyStatus: string
  }
  milestones: PaymentMilestone[]
  managedPayments: ManagedPayment[]
  legacyPayments: LegacyPayment[]
  disputes: DisputeCase[]
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!payload || !response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`)
  return payload
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function money(value: number | null | undefined, currency = 'USD'): string {
  const amount = Number(value ?? 0)
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function dateTime(value: string | null | undefined): string {
  if (!value) return 'Not specified'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

function severityClass(severity: GovernanceFlag['severity']): string {
  if (severity === 'critical') return 'border-clay/35 bg-clay/10 text-clay-light'
  if (severity === 'warning') return 'border-gold/25 bg-gold/5 text-champagne/65'
  return 'border-champagne/10 bg-white/[0.025] text-champagne/50'
}

export function TransactionGovernancePanel({
  engagementId,
  mode,
  readOnly = false,
  endpoint,
  adminVault = false,
}: {
  engagementId: string
  mode: 'payments' | 'disputes'
  readOnly?: boolean
  endpoint?: string
  adminVault?: boolean
}) {
  const { toast } = useToast()
  const api = endpoint ?? `/api/planner/engagements/${engagementId}/transactions`
  const [data, setData] = useState<TransactionGovernanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await jsonRequest<{ data: TransactionGovernanceData }>(api)
      setData(payload.data)
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Transaction governance could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const openDisputes = useMemo(() => data?.disputes.filter((item) => item.status === 'OPEN') ?? [], [data?.disputes])
  const unresolvedDisputes = useMemo(() => openDisputes.filter((item) => !item.outcome), [openDisputes])

  async function postJson(action: string, body: Record<string, unknown>) {
    if (readOnly) return
    setWorking(true)
    setError(null)
    try {
      await jsonRequest(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      })
      await load()
      toast({ title: 'Governed record updated', description: 'The transaction evidence trail was appended without rewriting prior facts.' })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The governed action failed.'
      setError(message)
      toast({ title: 'Governed action failed', description: message, variant: 'destructive' })
    } finally {
      setWorking(false)
    }
  }

  async function postForm(form: FormData) {
    if (readOnly) return
    setWorking(true)
    setError(null)
    try {
      await jsonRequest(api, { method: 'POST', body: form })
      await load()
      toast({ title: 'Evidence recorded', description: 'The file is a governed Vault object linked to the transaction record.' })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The evidence action failed.'
      setError(message)
      toast({ title: 'Evidence action failed', description: message, variant: 'destructive' })
    } finally {
      setWorking(false)
    }
  }

  async function openVault(vaultObjectId: string) {
    if (!data) return
    try {
      const url = adminVault
        ? `/api/admin/vault/${vaultObjectId}?weddingId=${encodeURIComponent(data.engagement.weddingId)}`
        : `/api/planner/vault/${vaultObjectId}`
      const payload = await jsonRequest<{ data: { signedUrl: string } }>(url)
      window.open(payload.data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      toast({
        title: 'Vault object unavailable',
        description: caught instanceof Error ? caught.message : 'Secure download could not be created.',
        variant: 'destructive',
      })
    }
  }

  if (loading && !data) {
    return <div className="flex items-center gap-2 rounded-lg border border-gold/10 p-4 text-xs text-champagne/45"><Loader2 className="size-4 animate-spin" />Loading governed transaction records…</div>
  }

  if (!data) {
    return <div role="alert" className="rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay-light">{error || 'Transaction governance is unavailable.'}</div>
  }

  if (mode === 'payments') {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-gold/15 bg-gold/[0.03] p-3 text-[10px] leading-4 text-champagne/55">
          Payment records here are <strong className="text-champagne/70">facts only</strong>. Wewed does not receive, hold, escrow, or process vendor funds. Recording a payment never accepts a contract, makes an amendment effective, or overwrites the Budget ledger.
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-gold/10 p-3"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Governed commitment</p><p className="mt-1 text-sm text-champagne">{data.contractCommitment.amount === null ? 'Not established' : money(data.contractCommitment.amount, data.engagement.currency)}</p></div>
          <div className="rounded-lg border border-gold/10 p-3"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Budget committed</p><p className="mt-1 text-sm text-champagne">{money(data.reconciliation.budgetCommitted, data.engagement.currency)}</p></div>
          <div className="rounded-lg border border-gold/10 p-3"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Payment facts</p><p className="mt-1 text-sm text-champagne">{money(data.reconciliation.comparisonPaymentTotal, data.engagement.currency)}</p><p className="mt-1 text-[9px] text-champagne/35">{titleCase(data.reconciliation.comparisonSource)}</p></div>
          <div className="rounded-lg border border-gold/10 p-3"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Budget paid</p><p className="mt-1 text-sm text-champagne">{money(data.reconciliation.budgetPaid, data.engagement.currency)}</p></div>
        </div>

        {data.reconciliation.flags.length > 0 && (
          <div className="space-y-1.5">
            {data.reconciliation.flags.map((flag) => (
              <div key={flag.code} className={`rounded-lg border px-3 py-2 text-[10px] leading-4 ${severityClass(flag.severity)}`}>
                <span className="mr-1 font-semibold">{titleCase(flag.code)}:</span>{flag.message}
              </div>
            ))}
          </div>
        )}

        {!readOnly && (
          <div className="grid gap-3 lg:grid-cols-2">
            <form
              className="space-y-2 rounded-lg border border-gold/10 p-3"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                void postJson('createMilestone', {
                  milestoneType: form.get('milestoneType'),
                  label: form.get('label'),
                  description: form.get('description'),
                  amount: form.get('amount'),
                  currency: form.get('currency'),
                  dueAt: form.get('dueAt'),
                  proofRequired: form.get('proofRequired') !== 'false',
                  sequence: data.milestones.length,
                  contractId: data.contractCommitment.contractId,
                  contractVersionId: data.contractCommitment.versionId,
                })
              }}
            >
              <div><p className="text-xs font-medium text-champagne">Add payment milestone</p><p className="text-[10px] text-champagne/40">Milestones describe obligations; they do not move money.</p></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select name="milestoneType" defaultValue="INSTALLMENT" className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne"><option value="DEPOSIT">Deposit</option><option value="INSTALLMENT">Installment</option><option value="PRE_EVENT_BALANCE">Pre-event balance</option><option value="POST_EVENT_DELIVERY">Post-event / delivery</option><option value="SECURITY_DAMAGE_DEPOSIT">Security / damage deposit</option><option value="CUSTOM">Custom</option></select>
                <Input name="label" required placeholder="Milestone label" className="h-9 border-gold/20 bg-espresso" />
                <Input name="amount" type="number" min="0.01" step="0.01" required placeholder="Amount" className="h-9 border-gold/20 bg-espresso" />
                <Input name="currency" defaultValue={data.engagement.currency} maxLength={3} required className="h-9 border-gold/20 bg-espresso uppercase" />
                <Input name="dueAt" type="date" className="h-9 border-gold/20 bg-espresso" />
                <select name="proofRequired" defaultValue="true" className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne"><option value="true">Proof required</option><option value="false">Proof not required</option></select>
              </div>
              <textarea name="description" rows={2} placeholder="Optional milestone notes" className="w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-xs outline-none" />
              <Button type="submit" size="sm" disabled={working} className="bg-gold text-espresso hover:bg-gold-light"><WalletCards className="size-4" />Save milestone</Button>
            </form>

            <form
              className="space-y-2 rounded-lg border border-gold/10 p-3"
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                form.set('action', 'recordPayment')
                void postForm(form)
              }}
            >
              <div><p className="text-xs font-medium text-champagne">Record payment/refund fact</p><p className="text-[10px] text-champagne/40">Record an external fact. Wewed processor role remains NONE.</p></div>
              <div className="grid gap-2 sm:grid-cols-2">
                <select name="entryType" defaultValue="PAYMENT" className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne"><option value="PAYMENT">Payment</option><option value="REFUND">Refund</option></select>
                <select name="milestoneId" defaultValue="" className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne"><option value="">No milestone allocation</option>{data.milestones.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                <Input name="amount" type="number" min="0.01" step="0.01" required placeholder="Amount" className="h-9 border-gold/20 bg-espresso" />
                <Input name="currency" defaultValue={data.engagement.currency} maxLength={3} required className="h-9 border-gold/20 bg-espresso uppercase" />
                <Input name="paidAt" type="datetime-local" required className="h-9 border-gold/20 bg-espresso" />
                <Input name="method" placeholder="Method (e.g. bank transfer)" className="h-9 border-gold/20 bg-espresso" />
                <Input name="reference" placeholder="External reference" className="h-9 border-gold/20 bg-espresso" />
                <select name="proofRequired" defaultValue="true" className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne"><option value="true">Proof required</option><option value="false">Proof waived</option></select>
              </div>
              <Input name="proofWaiverReason" placeholder="Reason if proof is waived" className="h-9 border-gold/20 bg-espresso" />
              <Input name="proofFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv" className="h-9 border-gold/20 bg-espresso text-xs" />
              <textarea name="notes" rows={2} placeholder="Factual notes" className="w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-xs outline-none" />
              <input type="hidden" name="source" value="MANUAL_FACT" />
              <Button type="submit" size="sm" disabled={working} className="bg-gold text-espresso hover:bg-gold-light"><FileCheck2 className="size-4" />Record fact</Button>
            </form>
          </div>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Milestones</p><Button type="button" size="sm" variant="outline" onClick={() => void load()} className="h-7 border-gold/15 px-2 text-[10px] text-gold"><RefreshCw className="size-3" />Refresh</Button></div>
          {data.milestones.length === 0 ? <p className="rounded-lg border border-dashed border-gold/15 p-4 text-xs text-champagne/40">No governed milestones recorded.</p> : data.milestones.map((item) => <div key={item.id} className="rounded-lg border border-gold/10 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-champagne">{item.label}</p><p className="mt-1 text-[10px] text-champagne/40">{titleCase(item.milestoneType)} · due {dateTime(item.dueAt)} · {item.proofRequired ? 'proof required' : 'proof optional'}</p></div><div className="text-right"><p className="text-xs text-champagne">{money(item.amount, item.currency)}</p><p className="text-[10px] text-champagne/40">Outstanding {money(item.outstanding, item.currency)}</p></div></div></div>)}
        </section>

        <section className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-champagne/35">Managed immutable payment facts</p>
          {data.managedPayments.length === 0 ? <p className="rounded-lg border border-dashed border-gold/15 p-4 text-xs text-champagne/40">No Phase 4 payment facts recorded.</p> : data.managedPayments.map((payment) => <div key={payment.id} className="rounded-lg border border-gold/10 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-champagne">{titleCase(payment.entryType)} · {money(payment.amount, payment.currency)}</p><p className="mt-1 text-[10px] text-champagne/40">{dateTime(payment.paidAt)} · {payment.reference || 'no reference'} · {titleCase(payment.source)}</p><p className="mt-1 text-[9px] text-champagne/30">{payment.recordNature} · processor {payment.wewedProcessorRole} · custody {titleCase(payment.custodyStatus)}</p></div><div className="flex gap-1.5">{payment.proofVaultObjectId && <Button type="button" size="sm" variant="outline" onClick={() => void openVault(payment.proofVaultObjectId!)} className="h-8 border-gold/20 px-2 text-gold"><FileCheck2 className="size-3" />Proof</Button>}{!readOnly && payment.entryType !== 'REVERSAL' && <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => void postJson('reversePayment', { paymentId: payment.id, notes: 'Governed correction: reverse the immutable payment fact.' })} className="h-8 border-gold/20 px-2 text-gold"><RotateCcw className="size-3" />Reverse</Button>}</div></div></div>)}
        </section>

        {data.legacyPayments.length > 0 && <section className="space-y-2"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Legacy payment facts — shown separately</p>{data.legacyPayments.map((payment) => <div key={payment.id} className="rounded-lg border border-champagne/10 p-3 text-xs text-champagne/55">{money(payment.amount, payment.currency)} · {dateTime(payment.paidAt)} · {payment.reference || 'no reference'}</div>)}</section>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gold/15 bg-gold/[0.03] p-3 text-[10px] leading-4 text-champagne/55">
        A dispute issue is an <strong className="text-champagne/70">allegation until independently resolved</strong>. Wewed records notices, responses, negotiations, preserved evidence and externally/mutually established outcomes; Wewed does not adjudicate the underlying dispute.
      </div>

      {error && <div role="alert" className="rounded-lg border border-clay/30 bg-clay/10 p-3 text-xs text-clay-light">{error}</div>}

      {!readOnly && (
        <div className="grid gap-3 lg:grid-cols-2">
          <form className="space-y-2 rounded-lg border border-gold/10 p-3" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); void postJson('openDispute', { summary: form.get('summary'), contractId: data.contractCommitment.contractId, contractVersionId: data.contractCommitment.versionId }) }}>
            <div><p className="text-xs font-medium text-champagne">Open dispute record</p><p className="text-[10px] text-champagne/40">Describe the concern without stating an unproven breach as fact.</p></div>
            <textarea name="summary" required minLength={10} rows={3} className="w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-xs outline-none" placeholder="Factual summary of the issue" />
            <Button type="submit" size="sm" disabled={working} className="bg-gold text-espresso hover:bg-gold-light"><Scale className="size-4" />Open case</Button>
          </form>

          {openDisputes.length > 0 && <form className="space-y-2 rounded-lg border border-gold/10 p-3" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); void postJson('addIssue', { disputeCaseId: form.get('disputeCaseId'), clauseReference: form.get('clauseReference'), category: form.get('category'), allegationText: form.get('allegationText') }) }}>
            <p className="text-xs font-medium text-champagne">Add clause-linked issue</p>
            <select name="disputeCaseId" required className="h-9 w-full rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne">{openDisputes.map((item) => <option key={item.id} value={item.id}>{item.summary.slice(0, 70)}</option>)}</select>
            <div className="grid gap-2 sm:grid-cols-2"><Input name="category" required placeholder="Issue category" className="h-9 border-gold/20 bg-espresso" /><Input name="clauseReference" placeholder="Clause reference (optional)" className="h-9 border-gold/20 bg-espresso" /></div>
            <textarea name="allegationText" required rows={3} className="w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-xs outline-none" placeholder="Allegation / disputed issue" />
            <Button type="submit" size="sm" disabled={working} variant="outline" className="border-gold/20 text-gold"><AlertTriangle className="size-4" />Add issue</Button>
          </form>}

          {openDisputes.length > 0 && <form className="space-y-2 rounded-lg border border-gold/10 p-3" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); void postJson('recordEvent', { disputeCaseId: form.get('disputeCaseId'), issueId: form.get('issueId'), eventType: form.get('eventType'), source: 'IN_APP_ACTOR', note: form.get('note') }) }}>
            <p className="text-xs font-medium text-champagne">Record notice / response / negotiation</p>
            <select name="disputeCaseId" required className="h-9 w-full rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne">{openDisputes.map((item) => <option key={item.id} value={item.id}>{item.summary.slice(0, 70)}</option>)}</select>
            <select name="eventType" defaultValue="NOTICE_RECORDED" className="h-9 w-full rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne"><option value="NOTICE_RECORDED">Notice recorded</option><option value="PARTY_RESPONSE_RECORDED">Party response recorded</option><option value="NEGOTIATION_NOTE">Negotiation note</option></select>
            <textarea name="note" required rows={3} className="w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-xs outline-none" placeholder="Factual event note" />
            <Button type="submit" size="sm" disabled={working} variant="outline" className="border-gold/20 text-gold"><ShieldCheck className="size-4" />Append event</Button>
          </form>}

          {openDisputes.length > 0 && <form className="space-y-2 rounded-lg border border-gold/10 p-3" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); form.set('action', 'addDisputeEvidence'); void postForm(form) }}>
            <div><p className="text-xs font-medium text-champagne">Preserve dispute evidence</p><p className="text-[10px] text-champagne/40">The Vault object is immediately placed under an active evidence hold.</p></div>
            <select name="disputeCaseId" required className="h-9 w-full rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne">{openDisputes.map((item) => <option key={item.id} value={item.id}>{item.summary.slice(0, 70)}</option>)}</select>
            <Input name="issueId" placeholder="Issue ID (optional)" className="h-9 border-gold/20 bg-espresso" />
            <Input name="reason" required placeholder="Why this evidence must be preserved" className="h-9 border-gold/20 bg-espresso" />
            <Input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="h-9 border-gold/20 bg-espresso text-xs" />
            <textarea name="note" rows={2} placeholder="Evidence note" className="w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-xs outline-none" />
            <Button type="submit" size="sm" disabled={working} className="bg-gold text-espresso hover:bg-gold-light"><Upload className="size-4" />Preserve evidence</Button>
          </form>}

          {unresolvedDisputes.length > 0 && <form className="space-y-2 rounded-lg border border-gold/10 p-3" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const amount = String(form.get('amount') || '').trim(); void postJson('recordOutcome', { disputeCaseId: form.get('disputeCaseId'), source: form.get('source'), outcomeSummary: form.get('outcomeSummary'), remedyType: form.get('remedyType'), amount: amount || null, currency: form.get('currency'), externalReference: form.get('externalReference') }) }}>
            <div><p className="text-xs font-medium text-champagne">Record externally/mutually established outcome</p><p className="text-[10px] text-champagne/40">This is not a Wewed judgment.</p></div>
            <select name="disputeCaseId" required className="h-9 w-full rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne">{unresolvedDisputes.map((item) => <option key={item.id} value={item.id}>{item.summary.slice(0, 70)}</option>)}</select>
            <div className="grid gap-2 sm:grid-cols-2"><select name="source" defaultValue="MUTUAL_SETTLEMENT" className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne"><option value="MUTUAL_SETTLEMENT">Mutual settlement</option><option value="EXTERNAL_ADJUDICATION">External adjudication</option><option value="COURT_ORDER">Court order</option><option value="WITHDRAWAL">Withdrawal</option></select><select name="remedyType" defaultValue="NONE" className="h-9 rounded-md border border-gold/20 bg-espresso px-2 text-xs text-champagne"><option value="NONE">No monetary remedy</option><option value="REFUND">Refund</option><option value="SERVICE_CREDIT">Service credit</option><option value="FEE_ADJUSTMENT">Fee adjustment</option><option value="REPERFORMANCE">Re-performance</option><option value="CUSTOM">Custom</option></select><Input name="amount" type="number" min="0" step="0.01" placeholder="Remedy amount (optional)" className="h-9 border-gold/20 bg-espresso" /><Input name="currency" defaultValue={data.engagement.currency} maxLength={3} className="h-9 border-gold/20 bg-espresso uppercase" /></div>
            <Input name="externalReference" placeholder="Settlement/order/reference (optional)" className="h-9 border-gold/20 bg-espresso" />
            <textarea name="outcomeSummary" required rows={3} className="w-full rounded-md border border-gold/20 bg-espresso px-3 py-2 text-xs outline-none" placeholder="Outcome established by the named source" />
            <Button type="submit" size="sm" disabled={working} variant="outline" className="border-gold/20 text-gold"><Scale className="size-4" />Record outcome</Button>
          </form>}
        </div>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Dispute cases & evidence holds</p><Button type="button" size="sm" variant="outline" onClick={() => void load()} className="h-7 border-gold/15 px-2 text-[10px] text-gold"><RefreshCw className="size-3" />Refresh</Button></div>
        {data.disputes.length === 0 ? <p className="rounded-lg border border-dashed border-gold/15 p-4 text-xs text-champagne/40">No dispute case recorded for this Service Engagement.</p> : data.disputes.map((dispute) => (
          <article key={dispute.id} className="space-y-3 rounded-lg border border-gold/12 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-medium text-champagne">{dispute.summary}</p><p className="mt-1 text-[10px] text-champagne/40">Opened {dateTime(dispute.openedAt)}</p></div><Badge variant="outline" className="border-gold/20 text-gold">{titleCase(dispute.status)}</Badge></div>
            {dispute.issues.length > 0 && <div className="space-y-1.5"><p className="text-[9px] uppercase tracking-wide text-champagne/30">Issues — allegations, not findings</p>{dispute.issues.map((issue) => <div key={issue.id} className="rounded-md border border-champagne/10 p-2"><p className="text-[10px] text-champagne/65">{issue.category}{issue.clauseReference ? ` · ${issue.clauseReference}` : ''}</p><p className="mt-1 text-[10px] leading-4 text-champagne/45">{issue.allegationText}</p><p className="mt-1 text-[9px] text-gold/60">{issue.findingStatus}</p></div>)}</div>}
            {dispute.events.length > 0 && <div className="space-y-1.5"><p className="text-[9px] uppercase tracking-wide text-champagne/30">Event trail</p>{dispute.events.map((event) => <div key={event.id} className="rounded-md border border-champagne/10 p-2"><div className="flex justify-between gap-2"><p className="text-[10px] text-champagne/60">{titleCase(event.eventType)}</p><time className="text-[9px] text-champagne/30">{dateTime(event.createdAt)}</time></div><p className="mt-1 text-[10px] leading-4 text-champagne/45">{event.note}</p></div>)}</div>}
            {dispute.holds.length > 0 && <div className="space-y-1.5"><p className="text-[9px] uppercase tracking-wide text-champagne/30">Evidence holds</p>{dispute.holds.map((hold) => <div key={hold.id} className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-gold/10 p-2"><div><p className="text-[10px] text-champagne/60">{hold.reason}</p><p className="mt-1 text-[9px] text-champagne/35">{titleCase(hold.status)} · placed {dateTime(hold.placedAt)}</p></div><div className="flex gap-1.5"><Button type="button" size="sm" variant="outline" onClick={() => void openVault(hold.vaultObjectId)} className="h-8 border-gold/20 px-2 text-gold"><FileCheck2 className="size-3" />Evidence</Button>{!readOnly && hold.status === 'ACTIVE' && <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => { const reason = window.prompt('Why can this evidence hold be released?'); if (reason) void postJson('releaseHold', { holdId: hold.id, releaseReason: reason }) }} className="h-8 border-gold/20 px-2 text-gold"><ShieldCheck className="size-3" />Release hold</Button>}</div></div>)}</div>}
            {dispute.outcome && <div className="rounded-md border border-gold/20 bg-gold/[0.03] p-2"><p className="text-[9px] uppercase tracking-wide text-gold/65">Recorded outcome · {titleCase(dispute.outcome.source)}</p><p className="mt-1 text-[10px] leading-4 text-champagne/60">{dispute.outcome.outcomeSummary}</p><p className="mt-1 text-[9px] text-champagne/35">Remedy {titleCase(dispute.outcome.remedyType)}{dispute.outcome.amount !== null ? ` · ${money(dispute.outcome.amount, dispute.outcome.currency || data.engagement.currency)}` : ''} · Wewed adjudication role {dispute.outcome.wewedAdjudicationRole}</p></div>}
          </article>
        ))}
      </section>
    </div>
  )
}
