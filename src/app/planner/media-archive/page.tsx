'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, ArrowLeft, Download, HardDrive, Loader2, LockKeyhole, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

const ORDER = ['ACTIVE_PLANNING', 'LIVE_EVENT', 'POST_WEDDING', 'ARCHIVED'] as const
type ArchiveState = (typeof ORDER)[number]

type ArchiveSummary = {
  lifecycleState: ArchiveState
  retentionPolicy: string
  retentionUntil: string | null
  exportEnabled: boolean
  archivedAt: string | null
  updatedAt: string
  counts: {
    managed: number
    published: number
    archived: number
    backfillPending: number
    held: number
  }
}

function label(value: string): string {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase())
}

export default function PlannerMediaArchivePage() {
  const [data, setData] = useState<ArchiveSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/media/archive', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to load the wedding archive.')
      setData(payload.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load the wedding archive.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const nextState = useMemo(() => {
    if (!data) return null
    const index = ORDER.indexOf(data.lifecycleState)
    return index >= 0 && index < ORDER.length - 1 ? ORDER[index + 1] : null
  }, [data])

  async function advance() {
    if (!nextState) return
    setChanging(true)
    setError(null)
    try {
      const response = await fetch('/api/media/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetState: nextState }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Unable to advance the archive lifecycle.')
      setData(payload.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to advance the archive lifecycle.')
    } finally {
      setChanging(false)
    }
  }

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8" data-phase5-media-archive>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/planner" className="mb-2 inline-flex items-center gap-1.5 text-sm text-champagne/65 hover:text-gold">
            <ArrowLeft className="size-4" /> Planner workspace
          </Link>
          <h1 className="font-serif text-3xl text-champagne sm:text-4xl">Wedding Media Vault & Archive</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-champagne/65">
            Preserve wedding media in Wewed Vault, control publication separately from storage privacy, and carry authorized memories into the post-wedding archive.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-gold/30 text-gold">
          <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="mb-5 rounded-xl border border-gold/20 bg-gold/[0.05] p-4 text-sm text-champagne/75">
        <div className="flex gap-3">
          <LockKeyhole className="mt-0.5 size-5 shrink-0 text-gold" />
          <p><strong className="text-champagne">Originals remain private.</strong> Publishing a media item authorizes a controlled Wewed presentation route; it does not make the raw Vault object or storage path public. Evidence/legal holds continue to prevent destructive archival changes.</p>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex min-h-64 items-center justify-center text-champagne/60"><Loader2 className="mr-2 size-5 animate-spin" /> Loading archive…</div>
      ) : error && !data ? (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</div>
      ) : data ? (
        <div className="space-y-5">
          {error && <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

          <section className="rounded-2xl border border-gold/20 bg-black/15 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-gold/75">Archive lifecycle</p>
                <h2 className="mt-1 text-2xl font-semibold text-champagne">{label(data.lifecycleState)}</h2>
                <p className="mt-2 text-sm text-champagne/55">Retention policy: {label(data.retentionPolicy)}</p>
                <p className="text-sm text-champagne/55">Retention end: {data.retentionUntil ? new Date(data.retentionUntil).toLocaleDateString() : 'Not hard-coded; policy not yet configured'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.exportEnabled && (
                  <Button asChild variant="outline" className="border-gold/30 text-gold">
                    <a href="/api/media/archive/export"><Download className="mr-2 size-4" /> Export manifest</a>
                  </Button>
                )}
                {nextState && (
                  <Button onClick={() => void advance()} disabled={changing} className="bg-gold text-espresso hover:bg-gold/90">
                    {changing ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Archive className="mr-2 size-4" />}
                    Move to {label(nextState)}
                  </Button>
                )}
              </div>
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="Wedding media archive counts">
            {[
              ['Vault managed', data.counts.managed],
              ['Published', data.counts.published],
              ['Archived', data.counts.archived],
              ['Legacy backfill', data.counts.backfillPending],
              ['Held evidence', data.counts.held],
            ].map(([name, value]) => (
              <div key={String(name)} className="rounded-xl border border-champagne/10 bg-black/10 p-4">
                <HardDrive className="mb-3 size-4 text-gold/70" />
                <p className="text-2xl font-semibold text-champagne">{value}</p>
                <p className="mt-1 text-xs text-champagne/55">{name}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-champagne/10 bg-black/10 p-5">
              <h2 className="font-semibold text-champagne">New media</h2>
              <p className="mt-2 text-sm leading-6 text-champagne/60">New website/event uploads are registered as private Vault originals first. Images receive a governed thumbnail derivative. Presentation links resolve through Wewed authorization rather than permanent public storage URLs.</p>
            </div>
            <div className="rounded-xl border border-champagne/10 bg-black/10 p-5">
              <h2 className="font-semibold text-champagne">Existing media</h2>
              <p className="mt-2 text-sm leading-6 text-champagne/60">Legacy URL media is inventoried as a backfill candidate without pretending the original has already been copied. Existing classic wedding presentation remains compatible until rights-aware ingestion is completed.</p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
