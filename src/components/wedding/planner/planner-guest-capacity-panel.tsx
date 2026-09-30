'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CapacityRow {
  allocation: 'bride' | 'groom' | 'shared' | 'operational'
  registered: number
  attending: number
  hardLimit: number | null
  warningAt: number | null
  remaining: number | null
  warning: boolean
}

const LABEL: Record<CapacityRow['allocation'], string> = {
  bride: 'Bride',
  groom: 'Groom',
  shared: 'Shared',
  operational: 'Operational',
}

export function PlannerGuestCapacityPanel() {
  const [rows, setRows] = useState<CapacityRow[]>([])
  const [draft, setDraft] = useState<Record<string, { hardLimit: string; warningAt: string }>>({})
  const [busy, setBusy] = useState<string | null>('load')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy('load')
    try {
      const response = await fetch('/api/planner/guests/capacity', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load allocation capacity.')
      const next = payload.data as CapacityRow[]
      setRows(next)
      setDraft(Object.fromEntries(next.map((row) => [row.allocation, {
        hardLimit: row.hardLimit == null ? '' : String(row.hardLimit),
        warningAt: row.warningAt == null ? '' : String(row.warningAt),
      }])))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load allocation capacity.')
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function save(row: CapacityRow) {
    setBusy(row.allocation)
    setError(null)
    setSaved(null)
    const values = draft[row.allocation] ?? { hardLimit: '', warningAt: '' }
    try {
      const response = await fetch('/api/planner/guests/capacity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocation: row.allocation,
          hardLimit: values.hardLimit === '' ? null : Number(values.hardLimit),
          warningAt: values.warningAt === '' ? null : Number(values.warningAt),
        }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to save capacity.')
      setSaved(row.allocation)
      const next = payload.data as CapacityRow[]
      setRows(next)
      setDraft(Object.fromEntries(next.map((item) => [item.allocation, {
        hardLimit: item.hardLimit == null ? '' : String(item.hardLimit),
        warningAt: item.warningAt == null ? '' : String(item.warningAt),
      }])))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save capacity.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section data-testid="guest-capacity-allocation-panel" className="rounded-2xl border border-gold/15 bg-champagne/[0.035] p-4">
      <div className="mb-3">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-gold/70">Attendance capacity</p>
        <h3 className="mt-1 font-serif text-lg">Bride · Groom · Shared · Operational</h3>
        <p className="mt-1 font-sans text-xs leading-5 text-champagne/50">
          Relationship is recorded separately. These limits govern how many named Guest identities may be registered in each allocation.
        </p>
      </div>

      {error && <p role="alert" className="mb-3 rounded-lg border border-clay/30 bg-clay/10 p-2 text-xs text-clay-light">{error}</p>}
      {busy === 'load' && rows.length === 0 ? (
        <div className="flex min-h-20 items-center justify-center"><Loader2 className="size-5 animate-spin" /></div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-4">
          {rows.map((row) => {
            const values = draft[row.allocation] ?? { hardLimit: '', warningAt: '' }
            return (
              <div key={row.allocation} className="rounded-xl border border-gold/10 bg-espresso/45 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-serif text-lg">{LABEL[row.allocation]}</p>
                    <p className="font-sans text-xs text-champagne/55">
                      {row.registered}{row.hardLimit == null ? '' : ` / ${row.hardLimit}`} registered · {row.attending} attending
                    </p>
                  </div>
                  {row.warning && <AlertTriangle className="size-4 text-gold" aria-label="Capacity warning" />}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="font-sans text-[10px] uppercase tracking-wide text-champagne/45">
                    Hard limit
                    <Input
                      type="number"
                      min={0}
                      value={values.hardLimit}
                      onChange={(event) => setDraft((current) => ({ ...current, [row.allocation]: { ...values, hardLimit: event.target.value } }))}
                      className="mt-1 border-gold/20 bg-espresso/70"
                      aria-label={`${LABEL[row.allocation]} hard capacity limit`}
                    />
                  </label>
                  <label className="font-sans text-[10px] uppercase tracking-wide text-champagne/45">
                    Warn at
                    <Input
                      type="number"
                      min={0}
                      value={values.warningAt}
                      onChange={(event) => setDraft((current) => ({ ...current, [row.allocation]: { ...values, warningAt: event.target.value } }))}
                      className="mt-1 border-gold/20 bg-espresso/70"
                      aria-label={`${LABEL[row.allocation]} capacity warning threshold`}
                    />
                  </label>
                </div>
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void save(row)} className="mt-3 w-full border-gold/20">
                  {busy === row.allocation ? <Loader2 className="size-4 animate-spin" /> : saved === row.allocation ? <Check className="size-4" /> : null}
                  {saved === row.allocation ? 'Saved' : 'Save capacity'}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
