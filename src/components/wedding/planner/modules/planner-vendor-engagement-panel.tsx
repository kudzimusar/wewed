'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { FileCheck2, FileText, History, Plus, ReceiptText, ShieldCheck, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface HistoricalEvidenceRow {
  id: string
  linkRole: string
  displayName: string
  originalFilename: string
  mimeType: string
  byteSize: number
  checksumSha256: string
  storageState: string
  scanState: string
  createdAt: string
}

export interface HistoricalEngagementRow {
  id: string
  origin: 'historical'
  recordMode: 'record_only'
  serviceCategory: string
  serviceDescription: string | null
  agreedAmount: number | null
  currency: string
  serviceDate: string | null
  serviceLocation: string | null
  externalAgreementStatus: 'unknown' | 'exists' | 'none'
  externalAgreementReference: string | null
  historicalBasis: string | null
  vendorId: string
  payments: Array<{
    id: string
    amount: number
    currency: string
    paidAt: string | null
    method: string | null
    reference: string | null
    notes: string | null
  }>
  budgetItems: Array<{
    id: string
    description: string
    paidAmount: number
    actualCost: number | null
    estimatedCost: number
    currency: string
  }>
  evidence?: HistoricalEvidenceRow[]
  reconciliation: {
    totalRecordedPaid: number
    budgetPaid: number
    paymentDifference: number
  }
  createdAt: string
}

export interface PaidVendorRescueRow {
  vendorId: string
  vendorName: string
  category: string
  paymentStatus: string
  paidAmount: number
  budgetAmount: number
  engagementAmount: number
  engagementCount: number
  flags: {
    paidWithoutEngagement: boolean
    paidWithoutProof: boolean
    paidWithoutKnownAgreement: boolean
    partiallyPaid: boolean
    budgetEngagementMismatch: boolean
  }
}

export interface EngagementBudgetItem {
  id: string
  description: string
  estimatedCost: number
  actualCost: number | null
  paidAmount: number
  currency: string
  vendorId: string | null
}

export interface HistoricalEngagementCreateInput {
  vendorId: string
  serviceCategory: string
  serviceDescription: string | null
  agreedAmount: number | null
  currency: string
  serviceDate: string | null
  serviceLocation: string | null
  externalAgreementStatus: 'unknown' | 'exists' | 'none'
  externalAgreementReference: string | null
  historicalBasis: string | null
  budgetItemIds: string[]
  payments: Array<{
    amount: number
    paidAt: string | null
    method: string | null
    reference: string | null
    notes: string | null
  }>
}

interface PaymentDraft {
  key: string
  amount: string
  paidAt: string
  method: string
  reference: string
  notes: string
}

interface PlannerVendorEngagementPanelProps {
  vendor: { id: string; name: string; category: string; paymentStatus: string }
  budgetItems: EngagementBudgetItem[]
  engagements: HistoricalEngagementRow[]
  rescue?: PaidVendorRescueRow
  saving: boolean
  onCreate: (input: HistoricalEngagementCreateInput) => Promise<boolean>
  onUploadEvidence: (engagementId: string, file: File, linkRole: string) => Promise<boolean>
  onOpenEvidence: (vaultObjectId: string) => Promise<void>
}

const EVIDENCE_ROLES = [
  ['proof', 'Proof'],
  ['receipt', 'Receipt'],
  ['invoice', 'Invoice'],
  ['existing_agreement', 'Existing agreement'],
  ['evidence', 'Other evidence'],
] as const

function nullable(value: FormDataEntryValue | null): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function money(value: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'USD',
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${currency} ${value.toFixed(2)}`
  }
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function newPayment(amount = ''): PaymentDraft {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    amount,
    paidAt: '',
    method: '',
    reference: '',
    notes: '',
  }
}

function EvidenceList({
  engagement,
  saving,
  onUploadEvidence,
  onOpenEvidence,
}: {
  engagement: HistoricalEngagementRow
  saving: boolean
  onUploadEvidence: PlannerVendorEngagementPanelProps['onUploadEvidence']
  onOpenEvidence: PlannerVendorEngagementPanelProps['onOpenEvidence']
}) {
  const [linkRole, setLinkRole] = useState('proof')
  const evidence = engagement.evidence ?? []

  return (
    <div className="mt-3 rounded-lg border border-gold/10 bg-espresso/45 p-3">
      <div className="flex items-center gap-2">
        <FileCheck2 className="size-4 text-gold" />
        <p className="font-sans text-xs font-medium text-champagne">Private proof documents</p>
      </div>
      <p className="mt-1 font-sans text-[10px] leading-4 text-champagne/45">
        Files stay private in Wewed Vault. Opening a file creates a short-lived authorized download link.
      </p>

      {evidence.length > 0 && (
        <div className="mt-3 space-y-2">
          {evidence.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => void onOpenEvidence(file.id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-gold/10 px-3 py-2 text-left hover:border-gold/25"
            >
              <span className="min-w-0">
                <span className="block truncate font-sans text-xs text-champagne">{file.displayName}</span>
                <span className="block font-sans text-[10px] text-champagne/40">{titleCase(file.linkRole)} · {(file.byteSize / 1024).toFixed(0)} KB · {file.scanState === 'signature_validated' ? 'signature checked' : titleCase(file.scanState)}</span>
              </span>
              <FileText className="size-4 shrink-0 text-gold" />
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-3 grid gap-2 sm:grid-cols-[170px_1fr_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          const input = event.currentTarget.elements.namedItem('evidenceFile') as HTMLInputElement | null
          const file = input?.files?.[0]
          if (!file) return
          void onUploadEvidence(engagement.id, file, linkRole).then((ok) => {
            if (ok) event.currentTarget.reset()
          })
        }}
      >
        <select
          aria-label="Evidence type"
          value={linkRole}
          onChange={(event) => setLinkRole(event.target.value)}
          className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-xs"
        >
          {EVIDENCE_ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Input
          name="evidenceFile"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="border-gold/20 bg-espresso/70 text-xs file:text-champagne"
        />
        <Button type="submit" size="sm" disabled={saving} className="h-10 bg-gold text-espresso hover:bg-gold-light">
          <Upload className="size-3.5" />Upload
        </Button>
      </form>
    </div>
  )
}

export function PlannerVendorEngagementPanel({
  vendor,
  budgetItems,
  engagements,
  rescue,
  saving,
  onCreate,
  onUploadEvidence,
  onOpenEvidence,
}: PlannerVendorEngagementPanelProps) {
  const defaultPaid = rescue?.paidAmount && rescue.paidAmount > 0 ? String(rescue.paidAmount) : ''
  const [payments, setPayments] = useState<PaymentDraft[]>([newPayment(defaultPaid)])
  const vendorBudget = useMemo(
    () => budgetItems.filter((item) => item.vendorId === vendor.id),
    [budgetItems, vendor.id],
  )
  const defaultAgreed = vendorBudget.reduce(
    (sum, item) => sum + (item.actualCost ?? item.estimatedCost),
    0,
  )
  const defaultCurrency = vendorBudget[0]?.currency ?? 'USD'

  async function submitHistoricalRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amountText = String(form.get('agreedAmount') ?? '').trim()
    const selectedBudgetIds = form.getAll('budgetItemId').map(String)
    const paymentFacts = payments
      .filter((payment) => payment.amount.trim())
      .map((payment) => ({
        amount: Number(payment.amount),
        paidAt: payment.paidAt || null,
        method: payment.method.trim() || null,
        reference: payment.reference.trim() || null,
        notes: payment.notes.trim() || null,
      }))

    const ok = await onCreate({
      vendorId: vendor.id,
      serviceCategory: String(form.get('serviceCategory') ?? vendor.category).trim() || vendor.category,
      serviceDescription: nullable(form.get('serviceDescription')),
      agreedAmount: amountText ? Number(amountText) : null,
      currency: String(form.get('currency') ?? 'USD').trim().toUpperCase(),
      serviceDate: nullable(form.get('serviceDate')),
      serviceLocation: nullable(form.get('serviceLocation')),
      externalAgreementStatus: String(form.get('externalAgreementStatus') ?? 'unknown') as 'unknown' | 'exists' | 'none',
      externalAgreementReference: nullable(form.get('externalAgreementReference')),
      historicalBasis: nullable(form.get('historicalBasis')),
      budgetItemIds: selectedBudgetIds,
      payments: paymentFacts,
    })

    if (ok) setPayments([newPayment('')])
  }

  return (
    <details className="mt-3 rounded-xl border border-gold/15 bg-espresso/35">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-sans text-xs text-gold">
        <span className="inline-flex items-center gap-2"><History className="size-3.5" /> Service engagement record</span>
        <span className="flex items-center gap-1.5">
          {rescue?.flags.paidWithoutEngagement && <Badge variant="outline" className="border-clay/30 text-clay-light">Paid · record missing</Badge>}
          {engagements.length > 0 && <Badge variant="outline" className="border-gold/20 text-gold">{engagements.length} historical</Badge>}
        </span>
      </summary>

      <div className="space-y-3 border-t border-gold/10 p-3">
        <div className="rounded-lg border border-gold/10 bg-gold/[0.04] p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-gold" />
            <p className="font-sans text-[11px] leading-5 text-champagne/60">
              Historical rescue records facts that already existed. It does not create a Wewed contract, signature, acceptance date, or effective date for the past.
            </p>
          </div>
        </div>

        {rescue && (
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg border border-gold/10 p-2"><p className="text-[9px] uppercase tracking-wide text-champagne/40">Budget</p><p className="mt-1 text-champagne">{money(rescue.budgetAmount, defaultCurrency)}</p></div>
            <div className="rounded-lg border border-gold/10 p-2"><p className="text-[9px] uppercase tracking-wide text-champagne/40">Recorded paid</p><p className="mt-1 text-champagne">{money(rescue.paidAmount, defaultCurrency)}</p></div>
            <div className="rounded-lg border border-gold/10 p-2"><p className="text-[9px] uppercase tracking-wide text-champagne/40">Engagements</p><p className="mt-1 text-champagne">{rescue.engagementCount}</p></div>
            <div className="rounded-lg border border-gold/10 p-2"><p className="text-[9px] uppercase tracking-wide text-champagne/40">Rescue state</p><p className="mt-1 text-champagne">{rescue.flags.paidWithoutEngagement ? 'Needs record' : rescue.flags.paidWithoutProof ? 'Needs proof' : 'On record'}</p></div>
          </div>
        )}

        {engagements.map((engagement) => (
          <div key={engagement.id} className="rounded-xl border border-gold/15 bg-champagne/[0.025] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-serif text-base text-champagne">{engagement.serviceCategory}</p>
                <p className="mt-0.5 font-sans text-[10px] text-champagne/45">Historical record · Record only · Added {new Date(engagement.createdAt).toLocaleDateString()}</p>
              </div>
              <Badge variant="outline" className="border-gold/20 text-gold">External agreement: {titleCase(engagement.externalAgreementStatus)}</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
              <div><span className="text-champagne/40">Agreed amount</span><p className="text-champagne">{engagement.agreedAmount == null ? 'Unknown' : money(engagement.agreedAmount, engagement.currency)}</p></div>
              <div><span className="text-champagne/40">Payment facts</span><p className="text-champagne">{engagement.payments.length} · {money(engagement.reconciliation.totalRecordedPaid, engagement.currency)}</p></div>
              <div><span className="text-champagne/40">Linked budget</span><p className="text-champagne">{engagement.budgetItems.length} item{engagement.budgetItems.length === 1 ? '' : 's'}</p></div>
            </div>
            {engagement.externalAgreementReference && <p className="mt-2 font-sans text-[11px] text-champagne/55">Agreement evidence note: {engagement.externalAgreementReference}</p>}
            {engagement.historicalBasis && <p className="mt-1 font-sans text-[11px] text-champagne/45">Basis: {engagement.historicalBasis}</p>}
            {engagement.payments.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {engagement.payments.map((payment) => (
                  <div key={payment.id} className="flex flex-wrap items-center gap-x-2 rounded-lg border border-gold/10 px-2 py-1.5 font-sans text-[10px] text-champagne/55">
                    <ReceiptText className="size-3 text-gold" />
                    <span>{money(payment.amount, payment.currency)}</span>
                    <span>· {payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : 'date unknown'}</span>
                    {payment.method && <span>· {payment.method}</span>}
                    {payment.reference && <span>· ref {payment.reference}</span>}
                  </div>
                ))}
              </div>
            )}
            <EvidenceList engagement={engagement} saving={saving} onUploadEvidence={onUploadEvidence} onOpenEvidence={onOpenEvidence} />
          </div>
        ))}

        <details className="rounded-xl border border-dashed border-gold/20">
          <summary className="cursor-pointer list-none px-3 py-2 font-sans text-xs text-gold">
            <span className="inline-flex items-center gap-2"><Plus className="size-3.5" /> Record an existing paid/service engagement</span>
          </summary>
          <form className="grid gap-3 border-t border-gold/10 p-3 sm:grid-cols-2" onSubmit={submitHistoricalRecord}>
            <div><Label>Service/category</Label><Input name="serviceCategory" defaultValue={vendor.category} className="mt-1 border-gold/20 bg-espresso/70" /></div>
            <div><Label>Agreed amount</Label><Input name="agreedAmount" type="number" min="0" step="0.01" defaultValue={defaultAgreed > 0 ? defaultAgreed : ''} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Unknown can stay blank" /></div>
            <div><Label>Currency</Label><Input name="currency" defaultValue={defaultCurrency} maxLength={3} className="mt-1 border-gold/20 bg-espresso/70 uppercase" /></div>
            <div><Label>Service date</Label><Input name="serviceDate" type="date" className="mt-1 border-gold/20 bg-espresso/70" /></div>
            <div className="sm:col-span-2"><Label>Service description</Label><Input name="serviceDescription" className="mt-1 border-gold/20 bg-espresso/70" placeholder="What was already agreed/provided?" /></div>
            <div className="sm:col-span-2"><Label>Service location</Label><Input name="serviceLocation" className="mt-1 border-gold/20 bg-espresso/70" placeholder="Venue/location if known" /></div>
            <div><Label>Existing agreement state</Label><select name="externalAgreementStatus" defaultValue="unknown" className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="unknown">Unknown</option><option value="exists">Existing agreement exists</option><option value="none">No prior agreement document</option></select></div>
            <div><Label>Agreement/evidence note</Label><Input name="externalAgreementReference" className="mt-1 border-gold/20 bg-espresso/70" placeholder="e.g. paper contract held by planner" /></div>
            <div className="sm:col-span-2"><Label>Historical basis</Label><Input name="historicalBasis" className="mt-1 border-gold/20 bg-espresso/70" placeholder="Where these facts came from" /></div>

            {vendorBudget.length > 0 && (
              <fieldset className="sm:col-span-2">
                <legend className="font-sans text-xs text-champagne/70">Link existing Budget items</legend>
                <div className="mt-2 space-y-2">
                  {vendorBudget.map((item) => (
                    <label key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gold/10 px-3 py-2 font-sans text-xs text-champagne/60">
                      <span className="flex min-w-0 items-center gap-2"><input type="checkbox" name="budgetItemId" value={item.id} defaultChecked className="accent-current" /><span className="truncate">{item.description}</span></span>
                      <span className="shrink-0">{money(item.actualCost ?? item.estimatedCost, item.currency)} · {money(item.paidAmount, item.currency)} paid</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <legend className="font-sans text-xs text-champagne/70">Known payment facts</legend>
                <Button type="button" variant="outline" size="sm" className="h-7 border-gold/20 bg-transparent text-[10px] text-gold" onClick={() => setPayments((current) => [...current, newPayment()])}><Plus className="size-3" />Payment</Button>
              </div>
              {payments.map((payment, index) => (
                <div key={payment.key} className="grid gap-2 rounded-lg border border-gold/10 p-2 sm:grid-cols-5">
                  <Input aria-label={`Payment ${index + 1} amount`} type="number" min="0.01" step="0.01" placeholder="Amount" value={payment.amount} onChange={(event) => setPayments((current) => current.map((item) => item.key === payment.key ? { ...item, amount: event.target.value } : item))} className="border-gold/20 bg-espresso/70" />
                  <Input aria-label={`Payment ${index + 1} date`} type="date" value={payment.paidAt} onChange={(event) => setPayments((current) => current.map((item) => item.key === payment.key ? { ...item, paidAt: event.target.value } : item))} className="border-gold/20 bg-espresso/70" />
                  <Input aria-label={`Payment ${index + 1} method`} placeholder="Method" value={payment.method} onChange={(event) => setPayments((current) => current.map((item) => item.key === payment.key ? { ...item, method: event.target.value } : item))} className="border-gold/20 bg-espresso/70" />
                  <Input aria-label={`Payment ${index + 1} reference`} placeholder="Reference" value={payment.reference} onChange={(event) => setPayments((current) => current.map((item) => item.key === payment.key ? { ...item, reference: event.target.value } : item))} className="border-gold/20 bg-espresso/70" />
                  <div className="flex gap-2"><Input aria-label={`Payment ${index + 1} notes`} placeholder="Notes" value={payment.notes} onChange={(event) => setPayments((current) => current.map((item) => item.key === payment.key ? { ...item, notes: event.target.value } : item))} className="border-gold/20 bg-espresso/70" />{payments.length > 1 && <Button type="button" variant="ghost" size="sm" className="px-2 text-clay-light" onClick={() => setPayments((current) => current.filter((item) => item.key !== payment.key))}>×</Button>}</div>
                </div>
              ))}
            </fieldset>

            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" size="sm" disabled={saving} className="bg-gold text-espresso hover:bg-gold-light"><History className="size-3.5" />Save historical record</Button>
            </div>
          </form>
        </details>
      </div>
    </details>
  )
}
