'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Copy,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderLock,
  History,
  ListChecks,
  Mail,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EngagementBudgetItem } from '@/components/wedding/planner/modules/planner-vendor-engagement-panel'
import { useToast } from '@/hooks/use-toast'

export interface ManagedEngagementSummary {
  id: string
  vendorId: string
  lifecycleStatus: string
  serviceCategory: string
  agreedAmount?: string | number | null
  currency: string
  contracts?: Array<{
    id: string
    contractNumber: string
    status: string
    currentVersionNumber: number
  }>
}

interface DealRoomParty {
  id: string
  partyRole: string
  displayName: string
  email: string | null
  phone: string | null
  authorityBasis: string | null
  requiredForReview: boolean
}

interface DealRoomVersion {
  id: string
  versionNumber: number
  status: string
  templateSemanticVersion: string
  renderedHtml: string
  contentSha256: string | null
  artifactVaultObjectId: string | null
  artifactSha256: string | null
  issuedAt: string | null
  createdAt: string
}

interface DealRoomContract {
  id: string
  contractNumber: string
  status: string
  title: string
  currentVersionNumber: number
  issuedAt: string | null
  template: {
    code: string
    semanticVersion: string
    reviewStatus: string
    status: string
  }
  versions: DealRoomVersion[]
  reviewGrants: Array<{
    id: string
    role: string
    status: string
    expiresAt: string
    revokedAt: string | null
    lastAccessedAt: string | null
    engagementPartyId: string | null
  }>
  events: Array<{
    id: string
    eventType: string
    actorId: string | null
    metadata: string | null
    createdAt: string
  }>
}

interface DealRoomDocument {
  id: string
  entityType: string
  entityId: string
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

interface DealRoomRecord {
  id: string
  vendorId: string
  serviceCategory: string
  serviceDescription: string | null
  agreedAmount: string | null
  currency: string
  serviceDate: string | null
  serviceLocation: string | null
  lifecycleStatus: string
  vendor: {
    id: string
    name: string
    category: string
    email: string | null
    phone: string | null
  }
  parties: DealRoomParty[]
  budgetItems: Array<{
    id: string
    description: string
    estimatedCost: string | number
    actualCost: string | number | null
    paidAmount: string | number
    currency: string
  }>
  payments: Array<{
    id: string
    amount: string
    currency: string
    paidAt: string | null
    reference: string | null
  }>
  contracts: DealRoomContract[]
  documents: DealRoomDocument[]
}

interface ReviewLink {
  partyId: string
  role: string
  reviewUrl: string
  expiresAt: string
}

type Tab = 'overview' | 'contract' | 'payments' | 'documents' | 'messages' | 'tasks' | 'changes'

const TABS: Array<{ id: Tab; label: string; icon: typeof ShieldCheck }> = [
  { id: 'overview', label: 'Overview', icon: ShieldCheck },
  { id: 'contract', label: 'Contract', icon: FileText },
  { id: 'payments', label: 'Payments', icon: WalletCards },
  { id: 'documents', label: 'Documents', icon: FolderLock },
  { id: 'messages', label: 'Messages', icon: MessageSquare },
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'changes', label: 'Changes', icon: History },
]

async function governedJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!payload || !response.ok) throw new Error(payload?.error || `Request failed (${response.status}).`)
  return payload
}

function titleCase(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function money(value: string | number | null | undefined, currency = 'USD'): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return `${currency} —`
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function dateText(value: string | null | undefined): string {
  if (!value) return 'Not specified'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function safeWhatsAppNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length >= 8 && digits.length <= 15 ? digits : null
}

function latestVersion(contract: DealRoomContract | null): DealRoomVersion | null {
  return contract?.versions?.[0] ?? null
}

function StatusPill({ children }: { children: string }) {
  return <Badge variant="outline" className="border-gold/20 text-gold">{titleCase(children)}</Badge>
}

export function PlannerVendorDealRoom({
  vendor,
  budgetItems,
  engagement,
  saving,
  onRefresh,
}: {
  vendor: { id: string; name: string; category: string; email: string | null; phone: string | null }
  budgetItems: Array<EngagementBudgetItem & { serviceEngagementId?: string | null }>
  engagement?: ManagedEngagementSummary
  saving: boolean
  onRefresh: () => Promise<void>
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('overview')
  const [room, setRoom] = useState<DealRoomRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewLinks, setReviewLinks] = useState<ReviewLink[]>([])

  const loadRoom = useCallback(async () => {
    if (!engagement?.id) {
      setRoom(null)
      return
    }
    try {
      const payload = await governedJson<{ data: DealRoomRecord }>(`/api/planner/engagements/${engagement.id}/deal-room`)
      setRoom(payload.data)
      setError(null)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The Deal Room could not be loaded.'
      setError(message)
    }
  }, [engagement?.id])

  useEffect(() => {
    if (open && engagement?.id) void loadRoom()
  }, [open, engagement?.id, loadRoom])

  const eligibleBudget = useMemo(() => budgetItems.filter((item) =>
    !item.serviceEngagementId && (!item.vendorId || item.vendorId === vendor.id),
  ), [budgetItems, vendor.id])
  const contract = room?.contracts?.[0] ?? null
  const version = latestVersion(contract)
  const isIssued = Boolean(version?.issuedAt && version.status === 'ISSUED')

  async function createEngagement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const amountText = String(form.get('agreedAmount') ?? '').trim()
    setBusy(true)
    setError(null)
    try {
      await governedJson('/api/planner/engagements/current', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: vendor.id,
          serviceDescription: String(form.get('serviceDescription') ?? '').trim() || null,
          agreedAmount: amountText ? Number(amountText) : null,
          currency: String(form.get('currency') ?? 'USD').trim().toUpperCase(),
          serviceDate: String(form.get('serviceDate') ?? '').trim() || null,
          serviceLocation: String(form.get('serviceLocation') ?? '').trim() || null,
          budgetItemIds: form.getAll('budgetItemIds').map(String),
        }),
      })
      await onRefresh()
      toast({ title: 'Wewed Service Engagement created', description: 'Parties and authority were recorded. No contract acceptance has been created.' })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The Service Engagement could not be created.'
      setError(message)
      toast({ title: 'Service Engagement failed', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function generateDraft() {
    if (!room) return
    setBusy(true)
    setError(null)
    setReviewLinks([])
    try {
      await governedJson(`/api/planner/engagements/${room.id}/contracts`, { method: 'POST' })
      await loadRoom()
      await onRefresh()
      setTab('contract')
      toast({ title: 'Wewed contract draft generated', description: 'Review the exact branded draft before issuing it.' })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The contract draft could not be generated.'
      setError(message)
      toast({ title: 'Contract draft failed', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function issueContract() {
    if (!contract) return
    if (!window.confirm('Issue this exact Wewed contract version? Once issued, its content and Vault artifact cannot be edited in place.')) return
    setBusy(true)
    setError(null)
    try {
      const payload = await governedJson<{ data: { reviewLinks: ReviewLink[] } }>(`/api/planner/contracts/${contract.id}/issue`, { method: 'POST' })
      setReviewLinks(payload.data.reviewLinks ?? [])
      await loadRoom()
      await onRefresh()
      toast({ title: 'Contract version issued', description: 'The exact PDF and hashes are frozen in Wewed Vault. Viewing a review link is not acceptance.' })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The contract could not be issued.'
      setError(message)
      toast({ title: 'Contract issue failed', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function refreshReviewLinks() {
    if (!contract) return
    if (!window.confirm('Replace all current review links for this issued version? Existing links will stop working.')) return
    setBusy(true)
    setError(null)
    try {
      const payload = await governedJson<{ data: { reviewLinks: ReviewLink[] } }>(`/api/planner/contracts/${contract.id}/review-links`, { method: 'POST' })
      setReviewLinks(payload.data.reviewLinks ?? [])
      await loadRoom()
      toast({ title: 'Fresh secure review links created', description: 'Previous active links were revoked. Raw link tokens are shown only now.' })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'New review links could not be created.'
      setError(message)
      toast({ title: 'Review-link refresh failed', description: message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function copyReviewLink(link: ReviewLink) {
    try {
      await navigator.clipboard.writeText(link.reviewUrl)
      toast({ title: `${titleCase(link.role)} review link copied` })
    } catch {
      toast({ title: 'Copy failed', description: 'Your browser blocked clipboard access.', variant: 'destructive' })
    }
  }

  function shareText(link: ReviewLink): string {
    return `Wewed contract ${contract?.contractNumber ?? ''} version ${version?.versionNumber ?? 1} is ready for secure review: ${link.reviewUrl}\n\nViewing does not constitute acceptance. The authoritative version is stored by Wewed.`
  }

  function emailLink(link: ReviewLink) {
    const party = room?.parties.find((item) => item.id === link.partyId)
    const address = party?.email || (link.role === 'SERVICE_PROVIDER' ? vendor.email : null)
    if (!address) {
      toast({ title: 'No email on record', description: 'Copy the secure link and use the verified contact channel for this party.', variant: 'destructive' })
      return
    }
    window.location.href = `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent(`Wewed contract ${contract?.contractNumber ?? ''} for review`)}&body=${encodeURIComponent(shareText(link))}`
  }

  function whatsAppLink(link: ReviewLink) {
    const party = room?.parties.find((item) => item.id === link.partyId)
    const phone = safeWhatsAppNumber(party?.phone || (link.role === 'SERVICE_PROVIDER' ? vendor.phone : null))
    const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/'
    window.open(`${base}?text=${encodeURIComponent(shareText(link))}`, '_blank', 'noopener,noreferrer')
  }

  async function openVaultObject(id: string) {
    try {
      const payload = await governedJson<{ data: { signedUrl: string } }>(`/api/planner/vault/${id}`)
      window.open(payload.data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The private Vault document could not be opened.'
      toast({ title: 'Vault document unavailable', description: message, variant: 'destructive' })
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-gold/15 bg-espresso/45">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-gold" />
          <span>
            <span className="block font-sans text-xs font-semibold text-champagne">Wewed Service Engagement & Deal Room</span>
            <span className="block font-sans text-[10px] text-champagne/45">{engagement ? `${titleCase(engagement.lifecycleStatus)} · governed current service` : 'Create the governed record before generating a Wewed contract'}</span>
          </span>
        </span>
        {engagement ? <StatusPill>{engagement.lifecycleStatus}</StatusPill> : <Badge variant="outline" className="border-champagne/15 text-champagne/45">Not started</Badge>}
      </button>

      {open && (
        <div className="border-t border-gold/10 p-3">
          {error && <div role="alert" className="mb-3 rounded-lg border border-clay/25 bg-clay/[0.07] px-3 py-2 font-sans text-xs text-clay-light">{error}</div>}

          {!engagement ? (
            <form onSubmit={createEngagement} className="space-y-3">
              <div>
                <p className="font-serif text-base text-champagne">Start current service engagement</p>
                <p className="mt-1 font-sans text-[10px] leading-4 text-champagne/45">This creates a current Wewed commercial record with Couple/Client, Planner and Service Provider parties. It does not sign or accept a contract.</p>
              </div>
              <div><Label>Service scope</Label><textarea name="serviceDescription" rows={3} required className="mt-1 w-full rounded-md border border-gold/20 bg-espresso/70 px-3 py-2 text-sm outline-none focus:border-gold" placeholder={`Describe exactly what ${vendor.name} will provide`} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label>Agreed amount</Label><Input name="agreedAmount" type="number" min="0" step="0.01" className="mt-1 border-gold/20 bg-espresso/70" /></div>
                <div><Label>Currency</Label><Input name="currency" defaultValue="USD" maxLength={3} className="mt-1 border-gold/20 bg-espresso/70 uppercase" /></div>
                <div><Label>Service date</Label><Input name="serviceDate" type="date" className="mt-1 border-gold/20 bg-espresso/70" /></div>
                <div><Label>Service location</Label><Input name="serviceLocation" className="mt-1 border-gold/20 bg-espresso/70" placeholder="Venue or delivery location" /></div>
              </div>
              {eligibleBudget.length > 0 && (
                <div>
                  <Label>Link Budget items</Label>
                  <div className="mt-1 space-y-1 rounded-lg border border-gold/10 bg-espresso/35 p-2">
                    {eligibleBudget.map((item) => (
                      <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-xs hover:bg-gold/5">
                        <span className="flex items-center gap-2"><input type="checkbox" name="budgetItemIds" value={item.id} />{item.description}</span>
                        <span className="text-champagne/45">{money(item.actualCost ?? item.estimatedCost, item.currency)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <Button type="submit" size="sm" disabled={saving || busy} className="bg-gold text-espresso hover:bg-gold-light"><ShieldCheck className="size-4" />Create Service Engagement</Button>
            </form>
          ) : !room ? (
            <div className="flex items-center gap-2 py-5 text-xs text-champagne/50"><RefreshCw className="size-4 animate-spin" />Loading governed Deal Room…</div>
          ) : (
            <div>
              <div className="flex gap-1 overflow-x-auto pb-2">
                {TABS.map((item) => {
                  const Icon = item.icon
                  return <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-sans text-[10px] ${tab === item.id ? 'bg-gold text-espresso' : 'border border-gold/10 text-champagne/55 hover:text-gold'}`}><Icon className="size-3" />{item.label}</button>
                })}
              </div>

              {tab === 'overview' && (
                <div className="mt-2 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg border border-gold/10 p-2"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Service</p><p className="mt-1 text-xs text-champagne">{titleCase(room.serviceCategory)}</p></div>
                    <div className="rounded-lg border border-gold/10 p-2"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Agreed value</p><p className="mt-1 text-xs text-champagne">{money(room.agreedAmount, room.currency)}</p></div>
                    <div className="rounded-lg border border-gold/10 p-2"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Service date</p><p className="mt-1 text-xs text-champagne">{dateText(room.serviceDate)}</p></div>
                  </div>
                  <div className="rounded-lg border border-gold/10 p-3"><p className="text-[10px] uppercase tracking-wide text-champagne/35">Scope</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-champagne/70">{room.serviceDescription || 'No service scope recorded.'}</p></div>
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-wide text-champagne/35">Parties & authority</p>
                    <div className="grid gap-2 sm:grid-cols-3">{room.parties.map((party) => <div key={party.id} className="rounded-lg border border-gold/10 p-2"><p className="text-[10px] text-gold">{titleCase(party.partyRole)}</p><p className="mt-1 text-xs text-champagne">{party.displayName}</p><p className="mt-1 text-[10px] leading-4 text-champagne/40">{party.authorityBasis || 'Authority basis not recorded'}{party.requiredForReview ? ' · review required' : ''}</p></div>)}</div>
                  </div>
                </div>
              )}

              {tab === 'contract' && (
                <div className="mt-2 space-y-3">
                  {!contract ? (
                    <div className="rounded-lg border border-dashed border-gold/20 p-4"><p className="font-serif text-base">No Wewed contract draft yet</p><p className="mt-1 text-[10px] leading-4 text-champagne/45">Generate from the service-specific Wewed template. The template is currently operator-reviewed and makes no jurisdiction-specific enforceability claim.</p><Button type="button" size="sm" disabled={saving || busy} onClick={() => void generateDraft()} className="mt-3 bg-gold text-espresso hover:bg-gold-light"><FileText className="size-4" />Generate branded draft</Button></div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-gold/10 p-3">
                        <div><p className="font-serif text-base">{contract.title}</p><p className="mt-1 text-[10px] text-champagne/45">{contract.contractNumber} · Version {version?.versionNumber ?? contract.currentVersionNumber} · Template {contract.template.semanticVersion}</p></div>
                        <div className="flex gap-2"><StatusPill>{contract.status}</StatusPill><Badge variant="outline" className="border-champagne/15 text-champagne/45">{titleCase(contract.template.reviewStatus)}</Badge></div>
                      </div>

                      {version?.renderedHtml && <iframe title={`${contract.contractNumber} preview`} srcDoc={version.renderedHtml} sandbox="" className="h-[520px] w-full rounded-xl border border-gold/15 bg-white" />}

                      <div className="rounded-lg border border-gold/10 bg-gold/[0.03] p-3 text-[10px] leading-4 text-champagne/50">
                        Viewing is not acceptance. Phase 2 issues one immutable review version only; governed acceptance and amendments are Phase 3. An issued version cannot be edited in place.
                      </div>

                      {!isIssued ? (
                        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={saving || busy} onClick={() => void generateDraft()} className="border-gold/20 text-gold"><RefreshCw className="size-4" />Refresh draft from current engagement</Button><Button type="button" size="sm" disabled={saving || busy} onClick={() => void issueContract()} className="bg-gold text-espresso hover:bg-gold-light"><Send className="size-4" />Issue exact version</Button></div>
                      ) : (
                        <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={saving || busy} onClick={() => void refreshReviewLinks()} className="border-gold/20 text-gold"><RefreshCw className="size-4" />Create fresh review links</Button>{version?.artifactVaultObjectId && <Button type="button" size="sm" variant="outline" onClick={() => void openVaultObject(version.artifactVaultObjectId!)} className="border-gold/20 text-gold"><FileCheck2 className="size-4" />Open immutable PDF</Button>}<a href={`/contracts/verify/${encodeURIComponent(contract.contractNumber)}?v=${version?.versionNumber ?? 1}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-gold/20 px-3 text-xs text-gold hover:bg-gold/5">Verify version<ExternalLink className="size-3.5" /></a></div>
                      )}

                      {isIssued && reviewLinks.length === 0 && <p className="rounded-lg border border-gold/10 px-3 py-2 text-[10px] leading-4 text-champagne/45">Secure review tokens are never stored in plaintext. If this page was reloaded after issuance, create fresh links above; Wewed will revoke the prior active links before returning the replacements.</p>}
                      {reviewLinks.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase tracking-wide text-champagne/35">Secure review links — shown now only</p>
                          {reviewLinks.map((link) => {
                            const party = room.parties.find((item) => item.id === link.partyId)
                            return <div key={`${link.partyId}-${link.reviewUrl}`} className="rounded-lg border border-gold/10 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-medium text-champagne">{party?.displayName || titleCase(link.role)}</p><p className="text-[10px] text-champagne/40">{titleCase(link.role)} · expires {new Date(link.expiresAt).toLocaleString()}</p></div><div className="flex flex-wrap gap-1.5"><Button type="button" size="sm" variant="outline" onClick={() => void copyReviewLink(link)} className="h-8 border-gold/20 px-2 text-gold"><Copy className="size-3" />Copy</Button><Button type="button" size="sm" variant="outline" onClick={() => emailLink(link)} className="h-8 border-gold/20 px-2 text-gold"><Mail className="size-3" />Email</Button><Button type="button" size="sm" variant="outline" onClick={() => whatsAppLink(link)} className="h-8 border-gold/20 px-2 text-gold"><MessageSquare className="size-3" />WhatsApp</Button></div></div></div>
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {tab === 'payments' && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] leading-4 text-champagne/45">Phase 2 reconciles the Service Engagement with existing Budget/payment facts. Contract payment milestones and dispute accounting are introduced in Phase 4.</p>
                  {room.budgetItems.length === 0 ? <p className="rounded-lg border border-dashed border-gold/15 p-4 text-xs text-champagne/45">No Budget item is linked to this engagement.</p> : room.budgetItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-gold/10 p-3 text-xs"><span>{item.description}</span><span className="text-champagne/55">Paid {money(item.paidAmount, item.currency)} / {money(item.actualCost ?? item.estimatedCost, item.currency)}</span></div>)}
                </div>
              )}

              {tab === 'documents' && (
                <div className="mt-2 space-y-2">
                  <p className="text-[10px] leading-4 text-champagne/45">Issued contract artifacts are private Vault objects. Downloads use short-lived authorized URLs; the finalized PDF hash is retained with the contract version.</p>
                  {room.documents.length === 0 ? <p className="rounded-lg border border-dashed border-gold/15 p-4 text-xs text-champagne/45">No Deal Room documents yet.</p> : room.documents.map((document) => <button key={`${document.id}-${document.linkRole}`} type="button" onClick={() => void openVaultObject(document.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-gold/10 p-3 text-left hover:border-gold/25"><span className="min-w-0"><span className="block truncate text-xs text-champagne">{document.displayName}</span><span className="block text-[10px] text-champagne/40">{titleCase(document.linkRole)} · {document.mimeType} · {Math.max(1, Math.round(document.byteSize / 1024))} KB</span></span><ExternalLink className="size-3.5 shrink-0 text-gold" /></button>)}
                </div>
              )}

              {tab === 'messages' && (
                <div className="mt-2 rounded-lg border border-gold/10 p-3">
                  <p className="text-xs text-champagne">Contract delivery stays inside Wewed governance.</p>
                  <p className="mt-1 text-[10px] leading-4 text-champagne/45">Registered Wewed users use the existing Messages system. A planner Vendor record is not silently turned into a Wewed user; for an external vendor, use the secure review link’s Email or WhatsApp share action. The shared URL always points back to the authoritative Wewed version.</p>
                  <a href="/messages" className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-gold/20 px-2.5 text-xs text-gold"><MessageSquare className="size-3.5" />Open Wewed Messages</a>
                </div>
              )}

              {tab === 'tasks' && (
                <div className="mt-2 rounded-lg border border-gold/10 p-3"><p className="text-[10px] leading-4 text-champagne/45">Use the existing wedding task system for operational follow-up; Phase 2 does not create a disconnected contract task list.</p><a href="/planner/tasks" className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-gold/20 px-2.5 text-xs text-gold"><ListChecks className="size-3.5" />Open wedding Tasks</a></div>
              )}

              {tab === 'changes' && (
                <div className="mt-2 space-y-2">
                  {!contract || contract.events.length === 0 ? <p className="rounded-lg border border-dashed border-gold/15 p-4 text-xs text-champagne/45">No contract events yet.</p> : contract.events.map((event) => <div key={event.id} className="rounded-lg border border-gold/10 p-3"><div className="flex items-center justify-between gap-3"><p className="text-xs text-champagne">{titleCase(event.eventType)}</p><time className="text-[10px] text-champagne/35">{new Date(event.createdAt).toLocaleString()}</time></div></div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
