'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ALLOCATIONS = [
  { value: 'bride', label: 'Bride' },
  { value: 'groom', label: 'Groom' },
  { value: 'shared', label: 'Shared' },
  { value: 'operational', label: 'Operational' },
] as const

type Allocation = (typeof ALLOCATIONS)[number]['value']

interface AllocationUsage {
  allocation: Allocation
  registered: number
  attending: number
  hardLimit: number | null
  warningAt: number | null
  remaining: number | null
  warning: boolean
}

interface DraftLimit {
  hardLimit: string
  warningAt: string
}

function asDraft(row: AllocationUsage): DraftLimit {
  return {
    hardLimit: row.hardLimit == null ? '' : String(row.hardLimit),
    warningAt: row.warningAt == null ? '' : String(row.warningAt),
  }
}

export function PlannerAttendanceAllocationSettings() {
  const [rows, setRows] = useState<AllocationUsage[]>([])
  const [drafts, setDrafts] = useState<Record<Allocation, DraftLimit>>({
    bride: { hardLimit: '', warningAt: '' },
    groom: { hardLimit: '', warningAt: '' },
    shared: { hardLimit: '', warningAt: '' },
    operational: { hardLimit: '', warningAt: '' },
  })
  const [busy, setBusy] = useState<'load' | 'save' | null>('load')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setBusy('load')
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/allocation-limits', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.error || 'Unable to load allocation limits.')
      }
      const nextRows = payload.data as AllocationUsage[]
      setRows(nextRows)
      setDrafts((current) => {
        const next = { ...current }
        for (const row of nextRows) next[row.allocation] = asDraft(row)
        return next
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load allocation limits.')
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const byAllocation = useMemo(
    () => new Map(rows.map((row) => [row.allocation, row])),
    [rows],
  )

  async function save() {
    setBusy('save')
    setSaved(false)
    setError(null)
    try {
      const limits = ALLOCATIONS.map(({ value }) => {
        const draft = drafts[value]
        return {
          allocation: value,
          hardLimit: draft.hardLimit === '' ? null : Number(draft.hardLimit),
          warningAt: draft.warningAt === '' ? null : Number(draft.warningAt),
        }
      })
      const response = await fetch('/api/planner/guests/allocation-limits', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limits }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save allocation limits.')
      const nextRows = payload.data as AllocationUsage[]
      setRows(nextRows)
      setDrafts((current) => {
        const next = { ...current }
        for (const row of nextRows) next[row.allocation] = asDraft(row)
        return next
      })
      setSaved(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save allocation limits.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section data-testid="attendance-allocation-settings" className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">Attendance capacity</p>
          <h3 className="mt-1 font-serif text-lg">Allocation limits</h3>
          <p className="mt-1 max-w-3xl font-sans text-xs leading-5 text-champagne/50">
            Relationship/side stays descriptive. Capacity allocation is independently enforced as Bride, Groom, Shared or Operational.
            A hard limit blocks new registrations; the warning threshold surfaces pressure before the hard limit is reached.
          </p>
        </div>
        <Button type="button" onClick={() => void save()} disabled={busy !== null} className="bg-gold text-espresso hover:bg-gold-light">
          {busy === 'save' ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save limits
        </Button>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl border border-clay/30 bg-clay/10 p-3 text-xs text-clay-light">{error}</p>}
      {saved && <p className="mt-3 flex items-center gap-2 rounded-xl border border-sage/30 bg-sage/10 p-3 text-xs text-sage-light"><CheckCircle2 className="size-4" />Allocation limits saved.</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ALLOCATIONS.map(({ value, label }) => {
          const usage = byAllocation.get(value)
          const draft = drafts[value]
          const denominator = usage?.hardLimit == null ? '∞' : String(usage.hardLimit)
          return (
            <div key={value} className="rounded-xl border border-gold/10 bg-espresso/45 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-serif text-lg">{label}</p>
                  <p className="mt-1 font-sans text-xs text-champagne/55">
                    {usage?.registered ?? 0} / {denominator} registered · {usage?.attending ?? 0} attending
                  </p>
                </div>
                {usage?.warning && <AlertTriangle className="size-4 text-gold" aria-label="Warning threshold reached" />}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`allocation-${value}-warning`} className="text-[10px] uppercase tracking-wider text-champagne/45">Warn at</Label>
                  <Input
                    id={`allocation-${value}-warning`}
                    type="number"
                    min={0}
                    step={1}
                    value={draft.warningAt}
                    onChange={(event) => {
                      setSaved(false)
                      setDrafts((current) => ({ ...current, [value]: { ...current[value], warningAt: event.target.value } }))
                    }}
                    placeholder="None"
                    className="mt-1 border-gold/20 bg-espresso/70"
                  />
                </div>
                <div>
                  <Label htmlFor={`allocation-${value}-hard`} className="text-[10px] uppercase tracking-wider text-champagne/45">Hard limit</Label>
                  <Input
                    id={`allocation-${value}-hard`}
                    type="number"
                    min={0}
                    step={1}
                    value={draft.hardLimit}
                    onChange={(event) => {
                      setSaved(false)
                      setDrafts((current) => ({ ...current, [value]: { ...current[value], hardLimit: event.target.value } }))
                    }}
                    placeholder="Unlimited"
                    className="mt-1 border-gold/20 bg-espresso/70"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
