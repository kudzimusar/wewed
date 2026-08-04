'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Check, Copy, Download, Loader2, QrCode, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InvitationRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  tableNumber: number | null
  status: string
  checkedIn: boolean
  invitationUrl: string | null
  qrValue: string | null
}

function GuestQr({ value, name }: { value: string; name: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 240,
      color: { dark: '#1A1410', light: '#FBF6EE' },
    }).then((result) => { if (!cancelled) setSrc(result) })
    return () => { cancelled = true }
  }, [value])

  if (!src) return <div className="flex size-36 items-center justify-center rounded-xl bg-white"><Loader2 className="size-5 animate-spin text-gold-muted" /></div>
  return <img src={src} alt={`Private invitation QR code for ${name}`} className="size-36 rounded-xl border border-gold/20 bg-white p-2" />
}

export function InvitationManager({ compact = false }: { compact?: boolean }) {
  const [rows, setRows] = useState<InvitationRow[]>([])
  const [wedding, setWedding] = useState<{ slug: string; title: string } | null>(null)
  const [busy, setBusy] = useState<string | null>('load')
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setBusy('load')
    setError(null)
    try {
      const repair = await fetch('/api/planner/guests/invitations', { method: 'POST' })
      const repairPayload = await repair.json()
      if (!repair.ok || !repairPayload.success) throw new Error(repairPayload.error || 'Unable to prepare invitations.')
      const response = await fetch('/api/planner/guests/invitations', { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to load invitations.')
      setRows(payload.data)
      setWedding(payload.wedding)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load invitations.')
    } finally {
      setBusy(null)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  async function copy(row: InvitationRow) {
    if (!row.invitationUrl) return
    await navigator.clipboard.writeText(row.invitationUrl)
    setCopied(row.id)
    window.setTimeout(() => setCopied((current) => current === row.id ? null : current), 1600)
  }

  async function rotate(row: InvitationRow) {
    if (!window.confirm(`Rotate ${row.name}'s invitation? Their previous link and active guest session will stop working immediately.`)) return
    setBusy(row.id)
    setError(null)
    try {
      const response = await fetch('/api/planner/guests/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: row.id }),
      })
      const payload = await response.json()
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Unable to rotate invitation.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to rotate invitation.')
      setBusy(null)
    }
  }

  function downloadCsv() {
    window.location.href = '/api/planner/guests/invitations?format=csv'
  }

  return (
    <section className={compact ? '' : 'rounded-3xl border border-gold/20 bg-white p-5 sm:p-7'}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-muted">Guest QR invitations</p><h2 className="mt-2 font-serif text-3xl">{wedding?.title || 'Active wedding'}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-espresso/60">Each QR carries a unique guest credential. It opens the correct wedding, creates a secure scoped session and can be rotated if shared or compromised.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => void load()} disabled={busy !== null}><RefreshCw className={`size-4 ${busy === 'load' ? 'animate-spin' : ''}`} />Refresh</Button><Button type="button" variant="outline" onClick={downloadCsv}><Download className="size-4" />CSV</Button></div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-xl border border-clay/30 bg-clay/10 p-3 text-sm">{error}</p>}
      {busy === 'load' && rows.length === 0 ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-7 animate-spin text-gold-muted" /></div> : (
        <div className="mt-7 grid gap-5 lg:grid-cols-2">
          {rows.map((row) => (
            <article key={row.id} className="grid gap-5 rounded-2xl border border-gold/20 bg-champagne p-5 sm:grid-cols-[9rem_1fr]">
              {row.qrValue ? <GuestQr value={row.qrValue} name={row.name} /> : <div className="flex size-36 items-center justify-center rounded-xl border border-dashed border-gold/30"><QrCode className="size-9 text-gold/40" /></div>}
              <div className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-serif text-2xl">{row.name}</h3><p className="mt-1 text-xs text-espresso/55">{row.email || row.phone || 'No contact saved'}</p></div><span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]">{row.status}</span></div><p className="mt-3 text-xs text-espresso/55">Table: {row.tableNumber ?? 'Not assigned'} · {row.checkedIn ? 'Checked in' : 'Not checked in'}</p><div className="mt-5 flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => void copy(row)} disabled={!row.invitationUrl}><span>{copied === row.id ? <Check className="size-4" /> : <Copy className="size-4" />}</span>{copied === row.id ? 'Copied' : 'Copy link'}</Button><Button type="button" size="sm" variant="outline" onClick={() => void rotate(row)} disabled={busy !== null}><RotateCcw className={`size-4 ${busy === row.id ? 'animate-spin' : ''}`} />Rotate</Button></div></div>
            </article>
          ))}
          {rows.length === 0 && <p className="rounded-2xl border border-dashed border-gold/30 p-8 text-center text-sm text-espresso/55 lg:col-span-2">Add guests to generate private invitation links and QR codes.</p>}
        </div>
      )}
    </section>
  )
}
