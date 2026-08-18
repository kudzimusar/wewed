'use client'

import { useCallback, useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { ExternalLink, Mail, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  PlannerVendorEngagementPanel,
  type EngagementBudgetItem,
  type HistoricalEngagementCreateInput,
  type HistoricalEngagementRow,
  type PaidVendorRescueRow,
} from '@/components/wedding/planner/modules/planner-vendor-engagement-panel'
import { useToast } from '@/hooks/use-toast'

export interface VendorRow {
  id: string
  name: string
  category: string
  description: string | null
  contact: string
  contractStatus: string
  paymentStatus: string
  notes: string
  phone: string | null
  email: string | null
  website: string | null
  rating: number | null
  metaRating: number | null
}

export interface VendorForm {
  name: string
  category: string
  contact: string
  phone: string
  email: string
  website: string
  contractStatus: string
  paymentStatus: string
  rating: string
  notes: string
}

export interface VendorUpdate {
  contact: string | null
  phone: string | null
  email: string | null
  website: string | null
  contractStatus: string
  paymentStatus: string
  rating: number | null
  notes: string | null
}

interface PlannerVendorsModuleProps {
  vendors: VendorRow[]
  vendorForm: VendorForm
  setVendorForm: Dispatch<SetStateAction<VendorForm>>
  saving: boolean
  onAddVendor: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onUpdateVendor: (vendor: VendorRow, updates: VendorUpdate) => void | Promise<void>
  onDeleteVendor: (vendor: VendorRow) => void | Promise<void>
}

const VENDOR_CATEGORIES = [
  'venue',
  'caterer',
  'photographer',
  'videographer',
  'florist',
  'dj',
  'decor',
  'transport',
  'stationery',
  'other',
]

const CONTRACT_STATUSES = ['signed', 'pending', 'negotiating', 'declined']
const PAYMENT_STATUSES = ['paid', 'deposit', 'unpaid']

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function nullable(value: FormDataEntryValue | null): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-gold/15 bg-champagne/[0.035] ${className}`}>{children}</section>
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-gold/20 px-5 py-10 text-center"><p className="font-serif text-lg text-champagne">{title}</p><p className="mx-auto mt-2 max-w-lg font-sans text-xs leading-5 text-champagne/50">{detail}</p></div>
}

async function governanceJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!payload || !response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status}).`)
  }
  return payload
}

export function PlannerVendorsModule({ vendors, vendorForm, setVendorForm, saving, onAddVendor, onUpdateVendor, onDeleteVendor }: PlannerVendorsModuleProps) {
  const { toast } = useToast()
  const [engagements, setEngagements] = useState<HistoricalEngagementRow[]>([])
  const [rescue, setRescue] = useState<PaidVendorRescueRow[]>([])
  const [budgetItems, setBudgetItems] = useState<EngagementBudgetItem[]>([])
  const [governanceSaving, setGovernanceSaving] = useState(false)
  const [governanceError, setGovernanceError] = useState<string | null>(null)
  const combinedSaving = saving || governanceSaving

  const loadGovernance = useCallback(async () => {
    try {
      const [engagementPayload, rescuePayload, budgetPayload] = await Promise.all([
        governanceJson<{ data: HistoricalEngagementRow[] }>('/api/planner/engagements'),
        governanceJson<{ data: PaidVendorRescueRow[] }>('/api/planner/engagements/rescue'),
        governanceJson<{ data: EngagementBudgetItem[] }>('/api/planner/budget'),
      ])
      setEngagements(engagementPayload.data ?? [])
      setRescue(rescuePayload.data ?? [])
      setBudgetItems(budgetPayload.data ?? [])
      setGovernanceError(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not refresh vendor service records.'
      console.warn('[PLANNER VENDOR GOVERNANCE] refresh failed', error)
      setGovernanceError(message)
    }
  }, [])

  useEffect(() => {
    void loadGovernance()
  }, [loadGovernance, vendors.length])

  async function createHistoricalEngagement(input: HistoricalEngagementCreateInput): Promise<boolean> {
    setGovernanceSaving(true)
    setGovernanceError(null)
    try {
      await governanceJson('/api/planner/engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      await loadGovernance()
      toast({ title: 'Historical service record saved', description: 'Recorded as facts only — no retroactive Wewed acceptance was created.' })
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The historical service record could not be saved.'
      setGovernanceError(message)
      toast({ title: 'Historical record failed', description: message, variant: 'destructive' })
      return false
    } finally {
      setGovernanceSaving(false)
    }
  }

  async function uploadEngagementEvidence(engagementId: string, file: File, linkRole: string): Promise<boolean> {
    setGovernanceSaving(true)
    setGovernanceError(null)
    try {
      const form = new FormData()
      form.set('file', file)
      form.set('linkRole', linkRole)
      await governanceJson(`/api/planner/engagements/${engagementId}/evidence`, {
        method: 'POST',
        body: form,
      })
      await loadGovernance()
      toast({ title: 'Proof saved to Wewed Vault' })
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The proof document could not be uploaded.'
      setGovernanceError(message)
      toast({ title: 'Proof upload failed', description: message, variant: 'destructive' })
      return false
    } finally {
      setGovernanceSaving(false)
    }
  }

  async function openEngagementEvidence(vaultObjectId: string): Promise<void> {
    try {
      const payload = await governanceJson<{ data: { signedUrl: string } }>(`/api/planner/vault/${vaultObjectId}`)
      window.open(payload.data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The proof document could not be opened.'
      toast({ title: 'Proof unavailable', description: message, variant: 'destructive' })
    }
  }

  const rescueByVendor = new Map(rescue.map((item) => [item.vendorId, item]))
  const missingRecords = rescue.filter((item) => item.flags.paidWithoutEngagement).length

  return (
    <div className="space-y-4">
      <SectionCard className="p-4">
        <div className="mb-3">
          <h2 className="font-serif text-lg">Add vendor</h2>
          <p className="font-sans text-xs text-champagne/45">Save the operational details needed for sourcing, contracts, payments, and communication.</p>
        </div>
        <form onSubmit={onAddVendor} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div><Label htmlFor="workspace-vendor-name">Name</Label><Input id="workspace-vendor-name" value={vendorForm.name} onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Supplier name" /></div>
          <div><Label htmlFor="workspace-vendor-category">Category</Label><select id="workspace-vendor-category" value={vendorForm.category} onChange={(event) => setVendorForm((current) => ({ ...current, category: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{VENDOR_CATEGORIES.map((category) => <option key={category} value={category}>{titleCase(category)}</option>)}</select></div>
          <div><Label htmlFor="workspace-vendor-contact">Contact person</Label><Input id="workspace-vendor-contact" value={vendorForm.contact} onChange={(event) => setVendorForm((current) => ({ ...current, contact: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Primary contact name" /></div>
          <div><Label htmlFor="workspace-vendor-email">Email</Label><Input id="workspace-vendor-email" type="email" autoComplete="email" value={vendorForm.email} onChange={(event) => setVendorForm((current) => ({ ...current, email: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="vendor@example.com" /></div>
          <div><Label htmlFor="workspace-vendor-phone">Phone</Label><Input id="workspace-vendor-phone" value={vendorForm.phone} onChange={(event) => setVendorForm((current) => ({ ...current, phone: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="+263…" /></div>
          <div><Label htmlFor="workspace-vendor-website">Website</Label><Input id="workspace-vendor-website" type="url" value={vendorForm.website} onChange={(event) => setVendorForm((current) => ({ ...current, website: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="https://…" /></div>
          <div><Label htmlFor="workspace-vendor-contract">Contract status</Label><select id="workspace-vendor-contract" value={vendorForm.contractStatus} onChange={(event) => setVendorForm((current) => ({ ...current, contractStatus: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></div>
          <div><Label htmlFor="workspace-vendor-payment">Payment status</Label><select id="workspace-vendor-payment" value={vendorForm.paymentStatus} onChange={(event) => setVendorForm((current) => ({ ...current, paymentStatus: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></div>
          <div><Label htmlFor="workspace-vendor-rating">Vendor rating</Label><select id="workspace-vendor-rating" value={vendorForm.rating} onChange={(event) => setVendorForm((current) => ({ ...current, rating: event.target.value }))} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Not rated</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={String(rating)}>{rating} star{rating === 1 ? '' : 's'}</option>)}</select></div>
          <div className="sm:col-span-2 xl:col-span-2"><Label htmlFor="workspace-vendor-notes">Vendor notes</Label><Input id="workspace-vendor-notes" value={vendorForm.notes} onChange={(event) => setVendorForm((current) => ({ ...current, notes: event.target.value }))} className="mt-1 border-gold/20 bg-espresso/70" placeholder="Contract, delivery, or follow-up notes" /></div>
          <Button type="submit" disabled={combinedSaving} className="self-end bg-gold text-espresso hover:bg-gold-light"><Plus className="size-4" />Add vendor</Button>
        </form>
      </SectionCard>

      {governanceError && <div role="alert" className="rounded-xl border border-clay/25 bg-clay/[0.07] px-4 py-3 font-sans text-xs text-clay-light">Service-record status could not fully refresh: {governanceError}</div>}
      {missingRecords > 0 && (
        <div className="rounded-xl border border-clay/25 bg-clay/[0.07] px-4 py-3 font-sans text-xs text-clay-light">
          {missingRecords} paid vendor{missingRecords === 1 ? '' : 's'} still need a truthful historical service record. Open that vendor’s Service engagement record below; no past contract acceptance will be invented.
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {vendors.length === 0 ? <div className="lg:col-span-2"><EmptyState title="No vendors yet" detail="Add suppliers as you source them. Procurement status is kept with the selected wedding." /></div> : vendors.map((vendor) => {
          const rating = vendor.metaRating ?? vendor.rating ?? 0
          const vendorEngagements = engagements.filter((engagement) => engagement.vendorId === vendor.id)
          const rescueRow = rescueByVendor.get(vendor.id)
          const deletionProtected = vendorEngagements.length > 0
          return (
            <SectionCard key={vendor.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg">{vendor.name}</h3>
                  <p className="font-sans text-xs text-champagne/45">{titleCase(vendor.category)} · {vendor.contact || 'No contact person added'}</p>
                  <div className="mt-2 flex items-center gap-0.5" aria-label={`Vendor rating ${rating} of 5`}>{Array.from({ length: 5 }).map((_, index) => <Star key={index} className={`size-3 ${index < rating ? 'fill-gold text-gold' : 'text-champagne/20'}`} />)}</div>
                </div>
                <div className="flex items-center gap-2"><Badge variant="outline" className="border-gold/20 text-gold">{titleCase(vendor.contractStatus)}</Badge><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${vendor.name}`} title={deletionProtected ? 'Historical service records are preserved; this vendor cannot be deleted.' : `Delete ${vendor.name}`} disabled={combinedSaving || deletionProtected} onClick={() => { if (window.confirm(`Delete vendor “${vendor.name}”?`)) void onDeleteVendor(vendor) }} className="size-8 text-champagne/40 hover:bg-clay/10 hover:text-clay-light disabled:opacity-25"><Trash2 className="size-4" /></Button></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-champagne/55">
                <span>Payment: {titleCase(vendor.paymentStatus)}</span>
                {vendor.email && <a href={`mailto:${vendor.email}`} className="inline-flex items-center gap-1 text-gold hover:text-gold-light"><Mail className="size-3" />{vendor.email}</a>}
                {vendor.phone && <span>· {vendor.phone}</span>}
                {vendor.website && <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gold hover:text-gold-light">Website <ExternalLink className="size-3" /></a>}
              </div>
              {vendor.notes && <p className="mt-2 rounded-lg border border-gold/10 bg-espresso/40 px-3 py-2 font-sans text-xs text-champagne/55">{vendor.notes}</p>}

              <PlannerVendorEngagementPanel
                vendor={vendor}
                budgetItems={budgetItems}
                engagements={vendorEngagements}
                rescue={rescueRow}
                saving={combinedSaving}
                onCreate={createHistoricalEngagement}
                onUploadEvidence={uploadEngagementEvidence}
                onOpenEvidence={openEngagementEvidence}
              />

              <details className="mt-3 rounded-xl border border-gold/10 bg-espresso/35">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-sans text-xs text-gold"><Pencil className="size-3.5" /> Edit operational details</summary>
                <form className="grid gap-3 border-t border-gold/10 p-3 sm:grid-cols-2" onSubmit={(event) => {
                  event.preventDefault()
                  const form = new FormData(event.currentTarget)
                  const ratingValue = nullable(form.get('rating'))
                  void onUpdateVendor(vendor, {
                    contact: nullable(form.get('contact')),
                    phone: nullable(form.get('phone')),
                    email: nullable(form.get('email')),
                    website: nullable(form.get('website')),
                    contractStatus: String(form.get('contractStatus') ?? vendor.contractStatus),
                    paymentStatus: String(form.get('paymentStatus') ?? vendor.paymentStatus),
                    rating: ratingValue === null ? null : Number(ratingValue),
                    notes: nullable(form.get('notes')),
                  })
                }}>
                  <div><Label>Contact person</Label><Input name="contact" defaultValue={vendor.contact} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                  <div><Label>Email</Label><Input name="email" type="email" defaultValue={vendor.email ?? ''} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                  <div><Label>Phone</Label><Input name="phone" defaultValue={vendor.phone ?? ''} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                  <div><Label>Website</Label><Input name="website" type="url" defaultValue={vendor.website ?? ''} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                  <div><Label>Contract status</Label><select name="contractStatus" defaultValue={vendor.contractStatus} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></div>
                  <div><Label>Payment status</Label><select name="paymentStatus" defaultValue={vendor.paymentStatus} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm">{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></div>
                  <div><Label>Vendor rating</Label><select name="rating" defaultValue={rating ? String(rating) : ''} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Not rated</option>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={String(value)}>{value} star{value === 1 ? '' : 's'}</option>)}</select></div>
                  <div><Label>Vendor notes</Label><Input name="notes" defaultValue={vendor.notes} className="mt-1 border-gold/20 bg-espresso/70" /></div>
                  <div className="flex justify-end sm:col-span-2"><Button type="submit" size="sm" disabled={combinedSaving} className="bg-gold text-espresso hover:bg-gold-light">Save vendor details</Button></div>
                </form>
              </details>
            </SectionCard>
          )
        })}
      </div>
    </div>
  )
}
