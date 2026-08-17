'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, ShieldCheck, UserPlus, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InviteView {
  weddingTitle: string
  weddingDate: string
  location: string
  role: string
  roleLabel: string
  permissionSummary: string[]
  invitedByLabel: string
  note: string | null
  inviteeEmailHint: string | null
  expiresAt: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  canAccept: boolean
}

async function readJson<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; payload: T & { error?: string; code?: string } }> {
  const response = await fetch(url, { cache: 'no-store', ...init })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string; code?: string }
  return { ok: response.ok, status: response.status, payload }
}

function dateText(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

export default function TeamJoinPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token ?? ''
  const [invite, setInvite] = useState<InviteView | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signInRequired, setSignInRequired] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void readJson<{ data?: InviteView }>(`/api/join/${encodeURIComponent(token)}`)
      .then(({ ok, payload }) => {
        if (cancelled) return
        if (!ok || !payload.data) {
          setError(payload.error || 'This invitation is unavailable.')
          return
        }
        setInvite(payload.data)
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load this invitation. Check your connection and try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  async function accept() {
    setAccepting(true)
    setError(null)
    setSignInRequired(false)
    try {
      const { ok, status, payload } = await readJson<{ data?: { destination?: string; weddingTitle?: string; role?: string } }>(
        `/api/join/${encodeURIComponent(token)}`,
        { method: 'POST' },
      )
      if (!ok) {
        if (status === 401 || payload.code === 'SIGN_IN_REQUIRED') setSignInRequired(true)
        setError(payload.error || 'This invitation could not be accepted.')
        return
      }
      window.location.href = payload.data?.destination || '/planner/overview#planner-workspace'
    } catch {
      setError('Unable to accept this invitation. Check your connection and try again.')
    } finally {
      setAccepting(false)
    }
  }

  return (
    <main className="min-h-dvh bg-ivory px-4 py-10 text-espresso sm:py-16">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-gold/25 bg-white shadow-xl">
        <div className="bg-espresso px-6 py-7 text-champagne sm:px-8">
          <div className="flex items-center gap-2 text-gold"><ShieldCheck className="size-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em]">Secure Wewed team invitation</span></div>
          <h1 className="mt-4 font-serif text-3xl sm:text-4xl">Join a wedding project</h1>
          <p className="mt-2 text-sm leading-6 text-champagne/65">Scanning or opening this page does not grant access. Review the invitation, sign in to your own account, then explicitly accept.</p>
        </div>

        <div className="p-6 sm:p-8">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center gap-2 text-espresso/55"><Loader2 className="size-5 animate-spin text-gold" />Checking invitation…</div>
          ) : error && !invite ? (
            <div role="alert" className="rounded-2xl border border-clay/30 bg-clay/5 p-5"><div className="flex items-center gap-2 font-semibold text-clay"><XCircle className="size-5" />Invitation unavailable</div><p className="mt-2 text-sm leading-6 text-espresso/65">{error}</p></div>
          ) : invite ? (
            <div className="space-y-6">
              <section>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Wedding / project</p>
                <h2 className="mt-1 font-serif text-3xl">{invite.weddingTitle}</h2>
                <p className="mt-2 text-sm text-espresso/60">{dateText(invite.weddingDate)}{invite.location ? ` · ${invite.location}` : ''}</p>
              </section>

              <section className="rounded-2xl border border-gold/20 bg-ivory/70 p-5">
                <p className="text-sm text-espresso/60">You have been invited as</p>
                <p className="mt-1 font-serif text-2xl">{invite.roleLabel}</p>
                <p className="mt-2 text-sm text-espresso/60">Invited by <strong className="text-espresso">{invite.invitedByLabel}</strong></p>
                {invite.inviteeEmailHint && <p className="mt-1 text-xs text-espresso/50">Intended Wewed account: {invite.inviteeEmailHint}</p>}
                {invite.note && <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-espresso/65">{invite.note}</p>}
              </section>

              <section>
                <h3 className="font-semibold">What this role can do</h3>
                <ul className="mt-3 space-y-2">
                  {invite.permissionSummary.map((item) => <li key={item} className="flex items-start gap-2 text-sm leading-6 text-espresso/65"><CheckCircle2 className="mt-1 size-4 shrink-0 text-sage" />{item}</li>)}
                </ul>
              </section>

              <div className="rounded-xl border border-gold/15 px-4 py-3 text-xs leading-5 text-espresso/55">Expires {dateText(invite.expiresAt)}. This link is single-use and can be revoked or rotated by an authorized wedding team member. It cannot grant platform-wide Wewed administrator authority.</div>

              {error && <p role="alert" className="rounded-xl border border-clay/30 bg-clay/5 px-4 py-3 text-sm text-clay">{error}</p>}

              {invite.canAccept ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" onClick={() => void accept()} disabled={accepting} className="min-h-12 flex-1 bg-gold text-espresso hover:bg-gold-light">{accepting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}Accept invitation</Button>
                  {signInRequired && <Button asChild variant="outline" className="min-h-12 flex-1 border-gold/35"><Link href={`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`}>Sign in / create account</Link></Button>}
                </div>
              ) : (
                <div className="rounded-xl border border-gold/20 bg-ivory px-4 py-4 text-sm text-espresso/65">This invitation is {invite.status}. Ask the inviter to create or rotate a secure invitation if access is still required.</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  )
}
