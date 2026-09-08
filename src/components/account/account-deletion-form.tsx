'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type AuthPayload = {
  authorized?: boolean
  user?: { email?: string } | null
}

export function AccountDeletionForm() {
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as AuthPayload | null
        const accountEmail = payload?.authorized ? payload.user?.email?.trim() : ''
        if (active && accountEmail) setEmail(accountEmail)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/account-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, reason, confirmed }),
      })
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean
        reference?: string
        error?: string
      } | null
      if (!response.ok || !payload?.success || !payload.reference) {
        throw new Error(payload?.error || 'Unable to submit the deletion request.')
      }
      setReference(payload.reference)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to submit the deletion request.')
    } finally {
      setSubmitting(false)
    }
  }

  if (reference) {
    return (
      <div className="rounded-3xl border border-emerald-700/20 bg-emerald-50 p-7 text-emerald-950 shadow-sm" role="status">
        <CheckCircle2 className="size-8 text-emerald-700" />
        <h2 className="mt-4 font-serif text-3xl">Request received</h2>
        <p className="mt-3 text-sm leading-7">Your reference is <strong>{reference}</strong>. Wewed will verify account ownership before deleting or anonymising account data.</p>
        <Button asChild variant="outline" className="mt-5 border-emerald-800/25 bg-white"><Link href="/">Return to Wewed</Link></Button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-gold/25 bg-white p-6 shadow-xl sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700"><Trash2 className="size-5" /></span>
        <div>
          <h2 className="font-serif text-3xl">Request account deletion</h2>
          <p className="mt-2 text-sm leading-6 text-espresso/65">Use the email attached to your account. If you are signed in, it is filled in automatically.</p>
        </div>
      </div>

      <label className="mt-7 block text-sm font-semibold" htmlFor="deletion-email">Account email</label>
      <input
        id="deletion-email"
        type="email"
        autoComplete="email"
        required
        maxLength={320}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-xl border border-gold/25 bg-ivory/35 px-4 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />

      <label className="mt-5 block text-sm font-semibold" htmlFor="deletion-reason">Anything we should know? <span className="font-normal text-espresso/45">Optional</span></label>
      <textarea
        id="deletion-reason"
        rows={4}
        maxLength={1200}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        className="mt-2 w-full rounded-xl border border-gold/25 bg-ivory/35 px-4 py-3 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
      />

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-red-900/10 bg-red-50/70 p-4 text-sm leading-6">
        <input type="checkbox" required checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1 size-4 accent-red-700" />
        <span>I understand that deletion removes access to my Wewed account and may remove or anonymise wedding data I control after ownership and authority checks.</span>
      </label>

      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}

      <Button type="submit" disabled={submitting || !confirmed} className="mt-6 min-h-12 w-full bg-red-800 text-white hover:bg-red-900">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Submit deletion request
      </Button>
    </form>
  )
}
