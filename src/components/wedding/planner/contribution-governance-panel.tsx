'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ChevronDown, ChevronUp, Loader2, Plus, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  CONTRIBUTION_CAMPAIGN_TYPE_LABELS,
  CONTRIBUTION_TYPE_LABELS,
  CONTRIBUTION_TYPES,
  type ContributionType,
} from '@/lib/contributions'

interface GovernanceCampaign {
  id: string
  type: string
  title: string
  description: string | null
  targetAmount: number | null
  currency: string
  published: boolean
  enabled: boolean
  sortOrder: number
  acceptedTypes: ContributionType[]
  budgetItemId: string | null
  serviceEngagementId: string | null
  showTarget: boolean
  showRaised: boolean
  invitationVisible: boolean
  showContributorRecognition: boolean
  externalUrl: string | null
  ctaLabel: string | null
  publicNote: string | null
}
interface GovernancePayload {
  success: boolean
  settings: { acceptingContributions: boolean; disabledMessage: string | null }
  campaigns: GovernanceCampaign[]
  options: {
    budgetItems: Array<{ id: string; description: string; category: string; currency: string; serviceEngagementId: string | null }>
    engagements: Array<{ id: string; serviceCategory: string; serviceDescription: string | null; currency: string; vendor: { id: string; name: string } }>
  }
}

const DEFAULT_CREATE = {
  type: 'HONEYMOON',
  title: '',
  description: '',
  currency: 'USD',
  targetAmount: '',
  budgetItemId: '',
  serviceEngagementId: '',
  acceptedTypes: ['CASH_TO_COUPLE', 'HONEYMOON_GIFT'] as ContributionType[],
}

export function ContributionGovernancePanel() {
  const [data, setData] = useState<GovernancePayload | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [disabledMessage, setDisabledMessage] = useState('')
  const [create, setCreate] = useState(DEFAULT_CREATE)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/planner/contribution-governance', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok || body.success === false) throw new Error(body.error || 'Could not load contribution settings.')
      setData(body)
      setDisabledMessage(body.settings?.disabledMessage ?? '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load contribution settings.')
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function mutate(method: 'POST' | 'PATCH', body: Record<string, unknown>) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/planner/contribution-governance', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json()
      if (!response.ok || payload.success === false) throw new Error(payload.error || 'Could not save contribution settings.')
      setData(payload)
      setDisabledMessage(payload.settings?.disabledMessage ?? '')
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save contribution settings.')
      return false
    } finally { setBusy(false) }
  }

  async function saveMaster(acceptingContributions: boolean) {
    await mutate('PATCH', { scope: 'settings', acceptingContributions, disabledMessage })
  }

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const ok = await mutate('POST', {
      ...create,
      targetAmount: create.targetAmount ? Number(create.targetAmount) : null,
      budgetItemId: create.budgetItemId || null,
      serviceEngagementId: create.serviceEngagementId || null,
      published: false,
      enabled: true,
      invitationVisible: true,
    })
    if (ok) setCreate(DEFAULT_CREATE)
  }

  async function patchCampaign(id: string, patch: Record<string, unknown>) {
    await mutate('PATCH', { id, ...patch })
  }

  async function moveCampaign(index: number, direction: -1 | 1) {
    if (!data) return
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= data.campaigns.length) return
    const reordered = [...data.campaigns]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]
    await mutate('PATCH', { scope: 'reorder', campaignIds: reordered.map((campaign) => campaign.id) })
  }

  function toggleCreateType(type: ContributionType, checked: boolean) {
    setCreate((current) => ({
      ...current,
      acceptedTypes: checked
        ? [...new Set([...current.acceptedTypes, type])]
        : current.acceptedTypes.filter((item) => item !== type),
    }))
  }

  if (!data) return <div className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-5 text-champagne"><Loader2 className="size-5 animate-spin text-gold" /></div>

  return (
    <section data-testid="contribution-governance-panel" className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4 text-champagne sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Guest contribution settings</p>
          <h2 className="mt-1 font-serif text-xl">What guests may contribute</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-champagne/50">Publishing a choice makes it available on the Couple Website. Turning contributions off stops new guest pledges without deleting the Planner ledger.</p>
        </div>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void saveMaster(!data.settings.acceptingContributions)}
          className={data.settings.acceptingContributions ? 'bg-sage text-espresso hover:bg-sage/90' : 'bg-gold text-espresso hover:bg-gold-light'}
        >
          Accept Contributions: {data.settings.acceptingContributions ? 'ON' : 'OFF'}
        </Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input aria-label="Disabled contributions message" value={disabledMessage} onChange={(event) => setDisabledMessage(event.target.value)} placeholder="Message shown when contributions are off" className="border-gold/20 bg-espresso/70" />
        <Button type="button" variant="outline" disabled={busy} onClick={() => void saveMaster(data.settings.acceptingContributions)} className="border-gold/20 bg-transparent"><Save className="size-4" />Save message</Button>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg border border-clay/30 bg-clay/10 px-3 py-2 text-xs text-clay-light">{error}</p>}

      <div className="mt-5 space-y-3">
        {data.campaigns.map((campaign, index) => (
          <div key={campaign.id} data-testid={`governance-campaign-${campaign.id}`} className="rounded-xl border border-gold/12 bg-espresso/30 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-medium">{campaign.title}</p><p className="mt-0.5 text-[11px] text-champagne/45">{campaign.currency} · {campaign.enabled ? 'Enabled' : 'Disabled'} · {campaign.published ? 'Published' : 'Private'}</p></div>
              <div className="flex flex-wrap gap-2">
                <Button aria-label={`Move ${campaign.title} up`} type="button" size="sm" variant="outline" disabled={busy || index === 0} onClick={() => void moveCampaign(index, -1)} className="border-gold/20 bg-transparent"><ChevronUp className="size-3.5" />Up</Button>
                <Button aria-label={`Move ${campaign.title} down`} type="button" size="sm" variant="outline" disabled={busy || index === data.campaigns.length - 1} onClick={() => void moveCampaign(index, 1)} className="border-gold/20 bg-transparent"><ChevronDown className="size-3.5" />Down</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void patchCampaign(campaign.id, { enabled: !campaign.enabled })} className="border-gold/20 bg-transparent">{campaign.enabled ? 'Disable' : 'Enable'}</Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void patchCampaign(campaign.id, { published: !campaign.published })} className="border-gold/20 bg-transparent">{campaign.published ? 'Unpublish' : 'Publish'}</Button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <Label>Accepted contribution types</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {CONTRIBUTION_TYPES.map((type) => {
                    const checked = campaign.acceptedTypes.includes(type)
                    return <label key={type} className="flex items-start gap-2 rounded-lg border border-gold/10 p-2 text-xs"><Checkbox checked={checked} onCheckedChange={(value) => { const next = value === true ? [...new Set([...campaign.acceptedTypes, type])] : campaign.acceptedTypes.filter((item) => item !== type); if (next.length) void patchCampaign(campaign.id, { acceptedTypes: next }) }} /><span>{CONTRIBUTION_TYPE_LABELS[type]}</span></label>
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <div><Label htmlFor={`campaign-budget-${campaign.id}`}>Budget item</Label><select id={`campaign-budget-${campaign.id}`} value={campaign.budgetItemId ?? ''} onChange={(event) => void patchCampaign(campaign.id, { budgetItemId: event.target.value || null })} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Not linked</option>{data.options.budgetItems.map((item) => <option key={item.id} value={item.id}>{item.description} · {item.currency}</option>)}</select></div>
                <div><Label htmlFor={`campaign-service-${campaign.id}`}>Vendor service for direct payment</Label><select id={`campaign-service-${campaign.id}`} value={campaign.serviceEngagementId ?? ''} onChange={(event) => void patchCampaign(campaign.id, { serviceEngagementId: event.target.value || null })} className="mt-1 h-10 w-full rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">Not linked</option>{data.options.engagements.map((item) => <option key={item.id} value={item.id}>{item.vendor.name} — {item.serviceCategory} · {item.currency}</option>)}</select></div>
                <label className="flex items-start gap-2 rounded-lg border border-gold/10 p-3 text-xs"><Checkbox checked={campaign.invitationVisible} onCheckedChange={(value) => void patchCampaign(campaign.id, { invitationVisible: value === true })} /><span>Show this choice from the invitation/Couple Website contribution entry.</span></label>
                <label className="flex items-start gap-2 rounded-lg border border-gold/10 p-3 text-xs"><Checkbox checked={campaign.showContributorRecognition} onCheckedChange={(value) => void patchCampaign(campaign.id, { showContributorRecognition: value === true })} /><span>Show names only for contributors who explicitly chose public recognition.</span></label>
              </div>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={createCampaign} className="mt-5 rounded-xl border border-gold/20 bg-gold/[0.035] p-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">Add contribution choice</p><p className="mt-1 text-xs text-champagne/50">New choices start private. Publish only after the purpose and accepted contribution methods are ready.</p></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="sr-only" htmlFor="new-contribution-campaign-type">Contribution choice type</label><select id="new-contribution-campaign-type" value={create.type} onChange={(event) => setCreate((current) => ({ ...current, type: event.target.value }))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm">{Object.entries(CONTRIBUTION_CAMPAIGN_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <Input aria-label="Contribution choice title" required value={create.title} onChange={(event) => setCreate((current) => ({ ...current, title: event.target.value }))} placeholder="Purpose, e.g. Honeymoon adventures" className="border-gold/20 bg-espresso/70" />
          <Textarea aria-label="Contribution choice description" value={create.description} onChange={(event) => setCreate((current) => ({ ...current, description: event.target.value }))} placeholder="Optional explanation for guests" className="sm:col-span-2 border-gold/20 bg-espresso/70" />
          <Input aria-label="Contribution choice currency" value={create.currency} maxLength={3} onChange={(event) => setCreate((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} placeholder="USD" className="border-gold/20 bg-espresso/70" />
          <Input aria-label="Contribution choice target" inputMode="decimal" value={create.targetAmount} onChange={(event) => setCreate((current) => ({ ...current, targetAmount: event.target.value }))} placeholder="Optional target" className="border-gold/20 bg-espresso/70" />
          <label className="sr-only" htmlFor="new-contribution-budget">Budget item</label><select id="new-contribution-budget" value={create.budgetItemId} onChange={(event) => setCreate((current) => ({ ...current, budgetItemId: event.target.value }))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">No Budget link yet</option>{data.options.budgetItems.map((item) => <option key={item.id} value={item.id}>{item.description}</option>)}</select>
          <label className="sr-only" htmlFor="new-contribution-service">Vendor service</label><select id="new-contribution-service" value={create.serviceEngagementId} onChange={(event) => setCreate((current) => ({ ...current, serviceEngagementId: event.target.value }))} className="h-10 rounded-md border border-gold/20 bg-espresso px-3 text-sm"><option value="">No vendor service link</option>{data.options.engagements.map((item) => <option key={item.id} value={item.id}>{item.vendor.name} — {item.serviceCategory}</option>)}</select>
        </div>
        <fieldset className="mt-4"><legend className="text-xs font-medium">Guests may contribute by</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CONTRIBUTION_TYPES.map((type) => <label key={type} className="flex items-start gap-2 rounded-lg border border-gold/10 p-2 text-xs"><Checkbox checked={create.acceptedTypes.includes(type)} onCheckedChange={(value) => toggleCreateType(type, value === true)} /><span>{CONTRIBUTION_TYPE_LABELS[type]}</span></label>)}</div></fieldset>
        <Button type="submit" disabled={busy || !create.title.trim() || create.acceptedTypes.length === 0} className="mt-4 bg-gold text-espresso hover:bg-gold-light">{busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}Create private choice</Button>
      </form>
    </section>
  )
}
