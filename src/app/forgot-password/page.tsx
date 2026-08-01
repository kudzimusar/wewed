'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) return

    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/reset-password`
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo },
      )

      if (recoveryError) {
        throw recoveryError
      }

      setSent(true)
    } catch (caught) {
      console.error('[auth/recovery] Unable to request password reset:', caught)
      setError('Unable to send the recovery email right now. Please try again shortly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-espresso px-5 py-10 text-champagne">
      <Card className="w-full max-w-lg border-gold/25 bg-white/[0.035] text-champagne shadow-2xl">
        <CardContent className="p-7 sm:p-10">
          <div className="text-center">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
              {sent ? <CheckCircle2 className="size-7" /> : <LockKeyhole className="size-7" />}
            </div>
            <p className="wewed-monogram mt-5 text-xs tracking-[0.3em]">WEWED · SECURE ACCESS</p>
            <h1 className="wewed-heading mt-3 text-3xl text-champagne">
              {sent ? 'Check your email' : 'Reset your password'}
            </h1>
          </div>

          {sent ? (
            <div className="mt-7 space-y-5 text-center">
              <p className="text-sm leading-6 text-champagne/65">
                When an eligible Wewed account exists for that address, a branded recovery email is sent with a secure link to choose a new password.
              </p>
              <div className="rounded-xl border border-gold/15 bg-black/15 p-4 text-left text-xs leading-5 text-champagne/55">
                Open only the newest Wewed recovery email. The link is single-use and time-limited. Wewed will never ask you to send a password or recovery token by email or chat.
              </div>
              <Button asChild className="w-full bg-gold text-espresso hover:bg-gold-light">
                <Link href="/admin">Return to secure sign-in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-7 space-y-5">
              <p className="text-center text-sm leading-6 text-champagne/60">
                Enter the email assigned to your Wewed account. We will send instructions to that inbox without revealing whether the address is registered.
              </p>

              <label className="block space-y-2" htmlFor="recovery-email">
                <span className="text-xs uppercase tracking-[0.18em] text-gold-muted">Email</span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold/50" />
                  <Input
                    id="recovery-email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      setError(null)
                    }}
                    autoComplete="email"
                    inputMode="email"
                    required
                    placeholder="you@example.com"
                    className="border-gold/30 bg-espresso/60 pl-10 text-champagne placeholder:text-champagne/30 focus:border-gold focus:ring-gold/20"
                  />
                </div>
              </label>

              {error && (
                <p className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-xs text-clay-light">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={!email.trim() || submitting}
                className="w-full bg-gold text-espresso hover:bg-gold-light disabled:opacity-40"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
                Send recovery email
              </Button>

              <Link
                href="/admin"
                className="flex items-center justify-center gap-2 text-sm text-champagne/55 transition hover:text-gold"
              >
                <ArrowLeft className="size-4" />
                Back to secure sign-in
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
