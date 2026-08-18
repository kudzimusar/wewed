'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileCheck2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PlannerVendorEngagementPanel,
  type EngagementBudgetItem,
  type HistoricalEngagementCreateInput,
  type HistoricalEngagementRow,
  type PaidVendorRescueRow,
} from '@/components/wedding/planner/modules/planner-vendor-engagement-panel'
import { useToast } from '@/hooks/use-toast'

type WeddingOption = {
  id: string
  slug: string
  title: string
  date: string
  venue: string
  venueCity: string
  venueCountry: string
}

type AdminVendor = {
  id: string
  name: string
  category: string
  paymentStatus: string
}

type RescueSummary = {
  paidVendors: number
  missingEngagement: number
  missingProof: number
  mismatchedAmount: number
}

type Payload = {
  success: boolean
  error?: string
  admin: {
    userId: string
    role: string
    canManage: boolean
  }
  weddings: WeddingOption[]
  selectedWedding: WeddingOption | null
  vendors: AdminVendor[]
  budgetItems: EngagementBudgetItem[]
  engagements: HistoricalEngagementRow[]
  rescue: {
    count: number
    summary: RescueSummary
    data: PaidVendorRescueRow[]
  }
}

async function adminJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json().catch(() => null)) as (T & { error?: string }) | null
  if (!payload || !response.ok) {
    throw new Error(payload?.error || `Request failed (${response.status}).`)
  }
  return payload
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

export function AdminHistoricalEngagementConsole() {
  const { toast } = useToast()
  const [data, setData] = useState<Payload | null>(null)
  const [weddings, setWeddings] = useState<WeddingOption[]>([])
  const [selectedWeddingId, setSelectedWeddingId] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadWedding = useCallback(async (weddingId: string) => {
    setLoading(true)
    setError(null)
    try {
      const suffix = weddingId ? `?weddingId=${encodeURIComponent(weddingId)}` : ''
      const payload = await adminJson<Payload>(`/api/admin/service-engagements${suffix}`)
      setWeddings(payload.weddings ?? [])
      setData(payload)
      setSelectedWeddingId(payload.selectedWedding?.id ?? weddingId)
      return payload
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to load service records.'
      setError(message)
      throw caught
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const initial = await loadWedding('')
        if (cancelled) return
        const first = initial.weddings[0]
        if (first) await loadWedding(first.id)
      } catch {
        // Error state is already rendered by loadWedding.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadWedding])

  async function createHistoricalEngagement(input: HistoricalEngagementCreateInput): Promise<boolean> {
    if (!selectedWeddingId || !data?.admin.canManage) return false
    setWorking(true)
    setError(null)
    try {
      await adminJson('/api/admin/service-engagements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weddingId: selectedWeddingId, ...input }),
      })
      await loadWedding(selectedWeddingId)
      toast({
        title: 'Historical service record saved',
        description: 'Admin recorded existing facts only; no retroactive Wewed acceptance was created.',
      })
      return true
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The historical record could not be saved.'
      setError(message)
      toast({ title: 'Historical record failed', description: message, variant: 'destructive' })
      return false
    } finally {
      setWorking(false)
    }
  }

  async function uploadEvidence(engagementId: string, file: File, linkRole: string): Promise<boolean> {
    if (!selectedWeddingId || !data?.admin.canManage) return false
    setWorking(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('weddingId', selectedWeddingId)
      form.set('file', file)
      form.set('linkRole', linkRole)
      await adminJson(`/api/admin/service-engagements/${engagementId}/evidence`, {
        method: 'POST',
        body: form,
      })
      await loadWedding(selectedWeddingId)
      toast({ title: 'Evidence saved to Wewed Vault' })
      return true
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Evidence could not be uploaded.'
      setError(message)
      toast({ title: 'Evidence upload failed', description: message, variant: 'destructive' })
      return false
    } finally {
      setWorking(false)
    }
  }

  async function openEvidence(vaultObjectId: string): Promise<void> {
    if (!selectedWeddingId) return
    try {
      const payload = await adminJson<{ data: { signedUrl: string } }>(
        `/api/admin/vault/${vaultObjectId}?weddingId=${encodeURIComponent(selectedWeddingId)}`,
      )
      window.open(payload.data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Evidence could not be opened.'
      toast({ title: 'Evidence unavailable', description: message, variant: 'destructive' })
    }
  }

  const rescueByVendor = useMemo(
    () => new Map((data?.rescue.data ?? []).map((item) => [item.vendorId, item])),
    [data?.rescue.data],
  )

  const orderedVendors = useMemo(() => {
    const vendors = [...(data?.vendors ?? [])]
    return vendors.sort((a, b) => {
      const aGap = rescueByVendor.get(a.id)?.flags.paidWithoutEngagement ? 1 : 0
      const bGap = rescueByVendor.get(b.id)?.flags.paidWithoutEngagement ? 1 : 0
      return bGap - aGap || a.name.localeCompare(b.name)
    })
  }, [data?.vendors, rescueByVendor])

  if (loading && !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-espresso text-gold">
        <Loader2 className="size-8 animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-espresso px-4 py-24 text-champagne sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold">Phase 0 · governed vendor history</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Historical service records</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-champagne/55">
              Support existing paid vendor relationships without rewriting history. Records created here are historical and record-only: they never create a Wewed signature, acceptance date, or effective date for past activity.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={loading || !selectedWeddingId}
            onClick={() => selectedWeddingId && void loadWedding(selectedWeddingId)}
            className="border-gold/25 bg-transparent text-gold hover:bg-gold/10"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </header>

        <section className="rounded-2xl border border-gold/15 bg-white/[0.03] p-4">
          <label className="text-xs font-medium text-champagne/60" htmlFor="admin-historical-wedding">Wedding in your Admin scope</label>
          <select
            id="admin-historical-wedding"
            value={selectedWeddingId}
            disabled={loading || weddings.length === 0}
            onChange={(event) => {
              const next = event.target.value
              setSelectedWeddingId(next)
              if (next) void loadWedding(next)
            }}
            className="mt-2 h-11 w-full rounded-lg border border-gold/20 bg-espresso px-3 text-sm text-champagne"
          >
            {weddings.length === 0 && <option value="">No scoped weddings available</option>}
            {weddings.map((wedding) => (
              <option key={wedding.id} value={wedding.id}>
                {wedding.title} · {new Date(wedding.date).toLocaleDateString()} · {wedding.venueCity}
              </option>
            ))}
          </select>
        </section>

        {error && <div role="alert" className="rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay-light">{error}</div>}

        {data && !data.admin.canManage && (
          <div className="rounded-xl border border-gold/20 bg-gold/5 p-4 text-sm text-champagne/60">
            <ShieldCheck className="mr-2 inline size-4 text-gold" />
            Your Admin role can inspect service records and evidence but cannot create records or upload evidence.
          </div>
        )}

        {data?.selectedWedding && (
          <>
            <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Paid vendors', data.rescue.summary.paidVendors],
                ['Missing records', data.rescue.summary.missingEngagement],
                ['Missing proof', data.rescue.summary.missingProof],
                ['Amount mismatches', data.rescue.summary.mismatchedAmount],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-gold/12 bg-white/[0.025] p-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-gold/65">{label}</p>
                  <p className="mt-1 font-serif text-2xl">{value}</p>
                </div>
              ))}
            </section>

            <section className="rounded-xl border border-gold/15 bg-white/[0.025] p-4">
              <div className="flex items-start gap-3">
                <FileCheck2 className="mt-0.5 size-5 shrink-0 text-gold" />
                <div>
                  <p className="font-medium">{data.selectedWedding.title}</p>
                  <p className="mt-1 text-xs text-champagne/45">
                    {data.selectedWedding.venue}, {data.selectedWedding.venueCity} · {new Date(data.selectedWedding.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              {orderedVendors.map((vendor) => {
                const engagements = data.engagements.filter((item) => item.vendorId === vendor.id)
                const vendorBudget = data.budgetItems.filter((item) => item.vendorId === vendor.id)
                const rescue = rescueByVendor.get(vendor.id)
                const currency = vendorBudget[0]?.currency ?? 'USD'
                return (
                  <section key={vendor.id} className="rounded-2xl border border-gold/15 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-serif text-xl">{vendor.name}</h2>
                        <p className="mt-1 text-xs text-champagne/45">{vendor.category.replaceAll('_', ' ')} · payment status {vendor.paymentStatus.replaceAll('_', ' ')}</p>
                      </div>
                      {rescue && <p className="text-xs text-champagne/55">{money(rescue.paidAmount, currency)} recorded paid</p>}
                    </div>
                    <PlannerVendorEngagementPanel
                      vendor={vendor}
                      budgetItems={data.budgetItems}
                      engagements={engagements}
                      rescue={rescue}
                      saving={working || !data.admin.canManage}
                      onCreate={createHistoricalEngagement}
                      onUploadEvidence={uploadEvidence}
                      onOpenEvidence={openEvidence}
                    />
                  </section>
                )
              })}
            </div>

            {orderedVendors.length === 0 && (
              <div className="rounded-xl border border-dashed border-gold/20 px-5 py-12 text-center text-sm text-champagne/50">
                This wedding has no Vendor records yet.
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
