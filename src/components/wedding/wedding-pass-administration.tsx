'use client'

import { useCallback, useEffect, useState } from 'react'
import qrcode from 'qrcode'
import { Loader2, ShieldCheck, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import {
  WEDDING_PASS_ADMIN_STATE_LABEL,
  type WeddingPassAdminState,
} from '@/lib/wedding-pass-availability'

interface WeddingPassAdminRow {
  guestId: string
  name: string
  state: WeddingPassAdminState
  party: { size: number; attendeeKeys: string[]; plusOneName: string | null }
  table: { number: number | null; name: string | null }
  checkIn: { admittedCount: number; admittedAttendeeKeys: string[] }
  credential: null | {
    passSerial: string | null
    tokenVersion: string | null
    issueSeq: number | null
    issuedAt: string | null
    expiresAt: string | null
    revokedAt: string | null
    revocationReason: string | null
    supersededAt: string | null
  }
}

interface WeddingPassAdminPayload {
  enabled: boolean
  issuanceWindow: { opensAt: string; cutoffAt: string; expiresAt: string }
  guests: WeddingPassAdminRow[]
}

interface ViewedWeddingPass {
  guestId: string
  guestName: string
  passSerial: string
  tokenVersion: string
  issueSeq: number
  issuedAt: string
  expiresAt: string | null
  token: string
}

// States in which the Guest holds a live credential that may be viewed.
const VIEWABLE_STATES: ReadonlySet<WeddingPassAdminState> = new Set(['active', 'partially_checked_in', 'checked_in'])

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function tableLabel(row: WeddingPassAdminRow): string {
  if (row.table.name) return row.table.name
  return row.table.number !== null ? `Table ${row.table.number}` : '—'
}

/**
 * Couple/Planner Wedding Pass administration: the venue-admission credential, deliberately kept
 * separate from Open Invitation and Printed Invitation Access QR codes. The list shows metadata
 * only. The exact credential is fetched only through the explicit "View Wedding Pass" action and
 * is rendered verbatim as the QR payload; it is never minted here, exported, or kept after close.
 */
export function WeddingPassAdministration() {
  const [payload, setPayload] = useState<WeddingPassAdminPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [viewed, setViewed] = useState<ViewedWeddingPass | null>(null)
  const [viewError, setViewError] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/planner/wedding-passes', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.error || 'Unable to load Wedding Passes.')
      setPayload(body.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load Wedding Passes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    let cancelled = false
    if (!viewed?.token) {
      setQrDataUrl(null)
      return
    }
    // The QR payload is the exact WeddingPassCredential.token — never a re-encoded equivalent.
    void qrcode
      .toDataURL(viewed.token, { width: 300, margin: 1, errorCorrectionLevel: 'M' })
      .then((value) => { if (!cancelled) setQrDataUrl(value) })
      .catch(() => { if (!cancelled) setViewError('Wedding Pass QR could not be prepared.') })
    return () => { cancelled = true }
  }, [viewed?.token])

  async function viewPass(guestId: string) {
    setViewing(guestId)
    setViewed(null)
    setViewError(null)
    try {
      const response = await fetch('/api/planner/wedding-passes/view', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId }),
      })
      const body = await response.json()
      if (!response.ok || !body.success) throw new Error(body.error || 'This guest has no active Wedding Pass.')
      setViewed(body.data)
    } catch (caught) {
      setViewError(caught instanceof Error ? caught.message : 'This guest has no active Wedding Pass.')
    }
  }

  function closeViewer() {
    setViewing(null)
    setViewed(null)
    setViewError(null)
    setQrDataUrl(null)
  }

  return (
    <section className="rounded-2xl border border-gold/25 bg-white p-4 sm:p-6" aria-labelledby="wedding-pass-admin-heading">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold-muted"><Ticket className="size-3.5" />Wedding Pass · venue admission</p>
      <h3 id="wedding-pass-admin-heading" className="mt-1 font-serif text-2xl text-espresso">Wedding Passes</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-espresso/60">
        The Wedding Pass is each attending guest&apos;s signed admission credential scanned at the gate. It is separate from the Open Invitation and Printed Invitation Access QR codes. Viewing this list never issues a Pass.
      </p>
      {payload && (
        <p className="mt-2 text-xs text-espresso/50">
          {payload.enabled ? 'Wedding Pass is enabled.' : 'Wedding Pass is not enabled for this wedding yet.'} Passes open {formatDate(payload.issuanceWindow.opensAt)} and issuance closes {formatDate(payload.issuanceWindow.cutoffAt)}.
        </p>
      )}

      {loading ? (
        <div className="flex min-h-24 items-center justify-center"><Loader2 className="size-6 animate-spin text-gold" /></div>
      ) : error ? (
        <p role="alert" className="mt-4 rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">{error}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm" data-testid="wedding-pass-admin-table">
            <thead className="text-xs uppercase tracking-[0.12em] text-espresso/50">
              <tr><th className="py-2 pr-3">Guest</th><th className="py-2 pr-3">State</th><th className="py-2 pr-3">Party</th><th className="py-2 pr-3">Table</th><th className="py-2 pr-3">Pass serial</th><th className="py-2 pr-3">Issued</th><th className="py-2 pr-3">Expires</th><th className="py-2" /></tr>
            </thead>
            <tbody>
              {payload?.guests.map((row) => (
                <tr key={row.guestId} className="border-t border-gold/15" data-testid={`wedding-pass-row-${row.guestId}`}>
                  <td className="py-2 pr-3 font-medium text-espresso">{row.name}</td>
                  <td className="py-2 pr-3" data-testid="wedding-pass-state" data-state={row.state}>{WEDDING_PASS_ADMIN_STATE_LABEL[row.state]}{row.state === 'partially_checked_in' ? ` (${row.checkIn.admittedCount}/${row.party.size})` : ''}</td>
                  <td className="py-2 pr-3">{row.party.size}</td>
                  <td className="py-2 pr-3">{tableLabel(row)}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{row.credential?.passSerial ?? '—'}{row.credential ? ` · ${row.credential.tokenVersion} #${row.credential.issueSeq}` : ''}</td>
                  <td className="py-2 pr-3 text-xs">{formatDate(row.credential?.issuedAt ?? null)}</td>
                  <td className="py-2 pr-3 text-xs">{formatDate(row.credential?.revokedAt ?? row.credential?.expiresAt ?? null)}</td>
                  <td className="py-2 text-right">
                    {VIEWABLE_STATES.has(row.state) && row.credential && !row.credential.revokedAt && !row.credential.supersededAt ? (
                      <Button type="button" size="sm" variant="outline" onClick={() => void viewPass(row.guestId)}>View Wedding Pass</Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {payload?.guests.length === 0 && <p className="mt-4 text-center text-sm text-espresso/55">No guests yet.</p>}
        </div>
      )}

      <Dialog open={viewing !== null} onOpenChange={(open) => { if (!open) closeViewer() }}>
        <DialogContent className="border-gold/30 bg-ivory text-espresso sm:max-w-md" data-testid="wedding-pass-admin-viewer">
          <DialogTitle className="flex items-center gap-2 font-serif text-2xl"><ShieldCheck className="size-5 text-gold-muted" />Wedding Pass</DialogTitle>
          <DialogDescription>This is the guest&apos;s exact active admission credential. Keep it private; this view is recorded.</DialogDescription>
          {viewError ? (
            <p role="alert" className="rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">{viewError}</p>
          ) : !viewed ? (
            <div className="flex min-h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-gold" /></div>
          ) : (
            <div className="text-center">
              <p className="font-serif text-2xl">{viewed.guestName}</p>
              <div className="mx-auto mt-4 flex min-h-64 max-w-72 items-center justify-center rounded-2xl border border-gold/30 bg-white p-3" data-testid="wedding-pass-admin-qr">
                {qrDataUrl ? <img src={qrDataUrl} alt="Wedding Pass QR code" className="h-auto w-full" /> : <Loader2 className="size-6 animate-spin text-gold" />}
              </div>
              <p className="mt-3 font-mono text-xs text-espresso/60">{viewed.passSerial} · {viewed.tokenVersion} #{viewed.issueSeq}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
