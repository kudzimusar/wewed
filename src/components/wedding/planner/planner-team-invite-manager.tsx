'use client'

import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import {
  Copy,
  Loader2,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface TeamInviteView {
  id: string
  role: 'owner' | 'planner' | 'coordinator' | 'viewer'
  roleLabel: string
  permissionSummary: string[]
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  note: string | null
  inviteeEmail: string | null
  invitedByLabel: string
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

interface InviteResponse {
  data?: TeamInviteView[] | TeamInviteView
  joinUrl?: string
  error?: string
}

const ROLE_OPTIONS = [
  ['planner', 'Planner'],
  ['coordinator', 'Coordinator'],
  ['viewer', 'Viewer / member'],
  ['owner', 'Owner / partner'],
] as const

const EXPIRY_OPTIONS = [
  [1, '1 hour'],
  [24, '24 hours'],
  [72, '3 days'],
  [168, '7 days'],
] as const

async function request<T extends InviteResponse>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json().catch(() => null)) as T | null
  if (!response.ok || !payload) throw new Error(payload?.error || `Request failed (${response.status}).`)
  return payload
}

function dateText(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function statusLabel(status: TeamInviteView['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function PlannerTeamInviteManager() {
  const { toast } = useToast()
  const [invites, setInvites] = useState<TeamInviteView[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [role, setRole] = useState<TeamInviteView['role']>('planner')
  const [expiryHours, setExpiryHours] = useState(24)
  const [inviteeEmail, setInviteeEmail] = useState('')
  const [note, setNote] = useState('')
  const [rawLinks, setRawLinks] = useState<Record<string, string>>({})
  const [qrImages, setQrImages] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await request<{ data?: TeamInviteView[]; error?: string }>('/api/weddings/team-invites')
      setInvites(payload.data ?? [])
    } catch (error) {
      toast({ title: 'Team invitations unavailable', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { void load() }, [load])

  async function rememberRawLink(invite: TeamInviteView, joinUrl: string) {
    const image = await QRCode.toDataURL(joinUrl, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1A1410', light: '#FBF6EE' },
    })
    setRawLinks((current) => ({ ...current, [invite.id]: joinUrl }))
    setQrImages((current) => ({ ...current, [invite.id]: image }))
  }

  async function createInvite() {
    setBusy(true)
    try {
      const payload = await request<{ data?: TeamInviteView; joinUrl?: string; error?: string }>('/api/weddings/team-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, expiryHours, inviteeEmail: inviteeEmail.trim() || null, note: note.trim() || null }),
      })
      if (!payload.data || !payload.joinUrl) throw new Error('Wewed did not return the new secure invitation.')
      await rememberRawLink(payload.data, payload.joinUrl)
      setInvites((current) => [payload.data!, ...current])
      setInviteeEmail('')
      setNote('')
      toast({ title: 'Secure team invitation created', description: 'The raw join link is shown only in this session. Share or print it now.' })
    } catch (error) {
      toast({ title: 'Invitation not created', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function mutateInvite(invite: TeamInviteView, action: 'revoke' | 'rotate') {
    if (action === 'revoke' && !window.confirm(`Revoke the ${invite.roleLabel} invitation? Anyone who has not already accepted it will no longer be able to use the link or QR.`)) return
    setBusy(true)
    try {
      const payload = await request<{ data?: TeamInviteView; joinUrl?: string; error?: string }>('/api/weddings/team-invites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId: invite.id, action, expiryHours }),
      })
      if (action === 'rotate' && payload.data && payload.joinUrl) {
        await rememberRawLink(payload.data, payload.joinUrl)
        toast({ title: 'Invitation rotated', description: 'The previous QR/link is revoked. Share the new one.' })
      } else {
        toast({ title: 'Invitation revoked' })
      }
      await load()
    } catch (error) {
      toast({ title: action === 'rotate' ? 'Invitation not rotated' : 'Invitation not revoked', description: error instanceof Error ? error.message : undefined, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  async function copyLink(invite: TeamInviteView) {
    const url = rawLinks[invite.id]
    if (!url) {
      toast({ title: 'Raw link is no longer stored', description: 'Rotate this invitation to create a fresh secure link and QR.' })
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Secure link copied' })
    } catch {
      toast({ title: 'Copy unavailable', description: 'Use Share or print the QR card instead.', variant: 'destructive' })
    }
  }

  async function shareLink(invite: TeamInviteView) {
    const url = rawLinks[invite.id]
    if (!url) {
      toast({ title: 'Raw link is no longer stored', description: 'Rotate this invitation to create a fresh secure link and QR.' })
      return
    }
    if (!navigator.share) {
      await copyLink(invite)
      return
    }
    try {
      await navigator.share({ title: `Join Wewed as ${invite.roleLabel}`, text: `Secure Wewed team invitation. Review the access before accepting.`, url })
    } catch {
      // User cancellation is not an error that needs another toast.
    }
  }

  function printQr(invite: TeamInviteView) {
    const image = qrImages[invite.id]
    const url = rawLinks[invite.id]
    if (!image || !url) {
      toast({ title: 'QR is no longer available in this session', description: 'Rotate the invitation to generate a fresh QR card.' })
      return
    }
    const printWindow = window.open('', '_blank', 'width=800,height=900')
    if (!printWindow) {
      toast({ title: 'Pop-up blocked', description: 'Allow pop-ups for Wewed and try again.', variant: 'destructive' })
      return
    }
    const safeRole = invite.roleLabel.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    const safeInviter = invite.invitedByLabel.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    printWindow.document.write(`<!doctype html><html><head><title>Wewed team invitation</title><style>@page{size:A4 portrait;margin:18mm}body{font-family:Arial,sans-serif;color:#211711;text-align:center;padding:20mm 10mm}h1{font-family:Georgia,serif;font-size:28pt;margin:8mm 0 2mm}.brand{text-transform:uppercase;letter-spacing:.18em;color:#8d6f3e;font-size:9pt;font-weight:700}.card{border:1px solid #d8cec0;border-radius:18px;padding:12mm;max-width:150mm;margin:0 auto}img{width:80mm;height:80mm;margin:8mm auto 4mm}.role{font-size:16pt;font-weight:700}.meta{color:#62584f;font-size:10pt;line-height:1.6}.security{margin-top:8mm;font-size:9pt;color:#62584f;border-top:1px solid #ddd4c8;padding-top:5mm}</style></head><body><div class="card"><p class="brand">Wewed secure team invitation</p><h1>Join this wedding project</h1><p class="role">${safeRole}</p><img src="${image}" alt="Secure join QR"><p class="meta">Invited by ${safeInviter}<br>Expires ${dateText(invite.expiresAt)}</p><p class="security">Scanning this QR does not grant access. The invitee must sign in to their own Wewed account, review the role, and explicitly accept. This QR cannot grant platform-wide Wewed administrator authority.</p></div></body></html>`)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 150)
  }

  return (
    <div className="space-y-5" data-planner-team-invites>
      <section className="rounded-2xl border border-gold/20 bg-espresso p-4 text-champagne sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold/10 text-gold"><ShieldCheck className="size-5" /></div>
          <div><h3 className="font-serif text-2xl">Invite a project team member</h3><p className="mt-1 text-sm leading-6 text-champagne/60">Create a single-use QR/link. Scanning never grants access by itself; the invitee must sign in and explicitly accept the role.</p></div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-champagne/75">Role<select value={role} onChange={(event) => setRole(event.target.value as TeamInviteView['role'])} className="mt-2 h-11 w-full rounded-xl border border-gold/30 bg-espresso px-3 text-champagne">{ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm text-champagne/75">Link expires<select value={expiryHours} onChange={(event) => setExpiryHours(Number(event.target.value))} className="mt-2 h-11 w-full rounded-xl border border-gold/30 bg-espresso px-3 text-champagne">{EXPIRY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-sm text-champagne/75">Invitee email <span className="text-champagne/40">(optional, locks acceptance to that account)</span><input type="email" value={inviteeEmail} onChange={(event) => setInviteeEmail(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-gold/30 bg-espresso px-3 text-champagne placeholder:text-champagne/35" placeholder="person@example.com" /></label>
          <label className="text-sm text-champagne/75">Context note <span className="text-champagne/40">(optional)</span><input value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-gold/30 bg-espresso px-3 text-champagne placeholder:text-champagne/35" placeholder="e.g. Day-of coordinator" /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Button type="button" disabled={busy} onClick={() => void createInvite()} className="min-h-11 bg-gold text-espresso hover:bg-gold-light">{busy ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}Generate secure QR & link</Button><p className="text-xs leading-5 text-champagne/45">Owner invites require owner-level authority. Platform administrator access is never available here.</p></div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-3"><div><h3 className="font-serif text-xl text-espresso">Team invitation status</h3><p className="text-xs text-espresso/55">Raw join links are not stored. For an older pending invite, rotate it to get a fresh QR/link.</p></div><Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading || busy} className="border-gold/30"><RefreshCw className="size-4" />Refresh</Button></div>

        {loading ? <div className="flex min-h-40 items-center justify-center gap-2 text-espresso/50"><Loader2 className="size-4 animate-spin text-gold" />Loading invitations…</div> : invites.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-gold/25 p-8 text-center text-sm text-espresso/55">No project team QR invitations have been created for this wedding.</div> : <div className="mt-4 space-y-3">{invites.map((invite) => {
          const freshLink = rawLinks[invite.id]
          const qr = qrImages[invite.id]
          const mutable = invite.status !== 'accepted'
          return <article key={invite.id} className="rounded-2xl border border-gold/20 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start gap-4">
              {qr ? <img src={qr} alt={`QR invitation for ${invite.roleLabel}`} className="size-28 rounded-xl border border-gold/15 bg-ivory p-1" /> : <div className="flex size-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-gold/25 bg-ivory text-center text-[11px] leading-4 text-espresso/45">Raw QR hidden after creation.<br />Rotate for a new one.</div>}
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-serif text-xl">{invite.roleLabel}</h4><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${invite.status === 'accepted' ? 'border-sage/40 bg-sage/10 text-sage' : invite.status === 'pending' ? 'border-gold/35 bg-gold/10 text-gold-muted' : 'border-clay/35 bg-clay/5 text-clay'}`}>{statusLabel(invite.status)}</span></div><p className="mt-1 text-xs text-espresso/55">Created {dateText(invite.createdAt)} · expires {dateText(invite.expiresAt)}</p>{invite.inviteeEmail && <p className="mt-1 text-xs text-espresso/55">Restricted to {invite.inviteeEmail}</p>}{invite.note && <p className="mt-2 text-sm text-espresso/65">{invite.note}</p>}{invite.acceptedAt && <p className="mt-2 text-xs font-medium text-sage">Accepted {dateText(invite.acceptedAt)}</p>}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={!freshLink} onClick={() => void copyLink(invite)} className="border-gold/25"><Copy className="size-4" />Copy link</Button>
              <Button type="button" size="sm" variant="outline" disabled={!freshLink} onClick={() => void shareLink(invite)} className="border-gold/25"><Send className="size-4" />Share</Button>
              <Button type="button" size="sm" variant="outline" disabled={!freshLink} onClick={() => printQr(invite)} className="border-gold/25"><Printer className="size-4" />Print QR card</Button>
              {mutable && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void mutateInvite(invite, 'rotate')} className="border-gold/25"><RotateCcw className="size-4" />Rotate</Button>}
              {invite.status === 'pending' && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void mutateInvite(invite, 'revoke')} className="text-clay"><Trash2 className="size-4" />Revoke</Button>}
            </div>
          </article>
        })}</div>}
      </section>
    </div>
  )
}
