'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

type RecoveryState = 'checking' | 'ready' | 'invalid' | 'complete'

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), [])
  const recoveryHandoffRef = useRef<Promise<boolean> | null>(null)
  const rejectedRecoveryRef = useRef(false)
  const [state, setState] = useState<RecoveryState>('checking')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function establishRecoverySession() {
      const url = new URL(window.location.href)
      const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
      const code = url.searchParams.get('code')
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const recoveryError = url.searchParams.get('error') ?? hash.get('error')

      // Remove one-time credentials and Auth error details from the address bar as
      // soon as they have been captured. React Strict Mode can run this effect twice,
      // so the handoff promise below is retained across the duplicate invocation.
      const cleanUrl = new URL(window.location.href)
      cleanUrl.searchParams.delete('code')
      cleanUrl.searchParams.delete('error')
      cleanUrl.searchParams.delete('error_code')
      cleanUrl.searchParams.delete('error_description')
      cleanUrl.hash = ''
      window.history.replaceState(null, '', `${cleanUrl.pathname}${cleanUrl.search}`)

      if (recoveryError) {
        rejectedRecoveryRef.current = true
      }

      if (rejectedRecoveryRef.current) {
        if (!cancelled) setState('invalid')
        return
      }

      if (!recoveryHandoffRef.current) {
        if (code) {
          recoveryHandoffRef.current = supabase.auth
            .exchangeCodeForSession(code)
            .then(({ error: exchangeError }) => !exchangeError)
            .catch(() => false)
        } else if (accessToken && refreshToken) {
          recoveryHandoffRef.current = supabase.auth
            .setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            .then(({ error: sessionError }) => !sessionError)
            .catch(() => false)
        }
      }

      if (recoveryHandoffRef.current) {
        const established = await recoveryHandoffRef.current
        if (!established) {
          if (!cancelled) setState('invalid')
          return
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return

      if (sessionError || !data.session) {
        setState('invalid')
        return
      }

      setState('ready')
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' && session) {
        setState('ready')
      }
    })

    void establishRecoverySession()

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [supabase])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < 12) {
      setError('Use at least 12 characters for the new password.')
      return
    }

    if (password !== confirmPassword) {
      setError('The two password entries do not match.')
      return
    }

    setSubmitting(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      await supabase.auth.signOut({ scope: 'global' })
      setPassword('')
      setConfirmPassword('')
      setState('complete')
    } catch (caught) {
      console.error('[auth/recovery] Unable to update password:', caught)
      setError('Unable to update the password. Request a new recovery email and try again.')
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
              {state === 'checking' ? (
                <Loader2 className="size-7 animate-spin" />
              ) : state === 'complete' ? (
                <CheckCircle2 className="size-7" />
              ) : state === 'invalid' ? (
                <ShieldAlert className="size-7" />
              ) : (
                <LockKeyhole className="size-7" />
              )}
            </div>
            <p className="wewed-monogram mt-5 text-xs tracking-[0.3em]">WEWED · SECURE ACCESS</p>
            <h1 className="wewed-heading mt-3 text-3xl text-champagne">
              {state === 'checking'
                ? 'Verifying recovery link'
                : state === 'complete'
                  ? 'Password updated'
                  : state === 'invalid'
                    ? 'Recovery link unavailable'
                    : 'Choose a new password'}
            </h1>
          </div>

          {state === 'checking' && (
            <p className="mt-7 text-center text-sm leading-6 text-champagne/60">
              Wewed is validating the single-use recovery session and removing sensitive tokens from the address bar.
            </p>
          )}

          {state === 'invalid' && (
            <div className="mt-7 space-y-5 text-center">
              <p className="text-sm leading-6 text-champagne/65">
                This link is invalid, expired, already used, or was not issued as a password-recovery link.
              </p>
              <Button asChild className="w-full bg-gold text-espresso hover:bg-gold-light">
                <Link href="/forgot-password">Request a new recovery email</Link>
              </Button>
            </div>
          )}

          {state === 'complete' && (
            <div className="mt-7 space-y-5 text-center">
              <p className="text-sm leading-6 text-champagne/65">
                Your password has been changed and previous Supabase sessions have been signed out. Sign in again using the new password.
              </p>
              <Button asChild className="w-full bg-gold text-espresso hover:bg-gold-light">
                <Link href="/sign-in">Continue to Wewed sign-in</Link>
              </Button>
            </div>
          )}

          {state === 'ready' && (
            <form onSubmit={submit} className="mt-7 space-y-5">
              <p className="text-center text-sm leading-6 text-champagne/60">
                Create a unique password with at least 12 characters. Do not reuse a password from another service.
              </p>

              <label className="block space-y-2" htmlFor="new-password">
                <span className="text-xs uppercase tracking-[0.18em] text-gold-muted">New password</span>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold/50" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setError(null)
                    }}
                    autoComplete="new-password"
                    minLength={12}
                    required
                    className="border-gold/30 bg-espresso/60 pl-10 pr-10 text-champagne focus:border-gold focus:ring-gold/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/50 transition hover:text-gold"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </label>

              <label className="block space-y-2" htmlFor="confirm-password">
                <span className="text-xs uppercase tracking-[0.18em] text-gold-muted">Confirm new password</span>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    setError(null)
                  }}
                  autoComplete="new-password"
                  minLength={12}
                  required
                  className="border-gold/30 bg-espresso/60 text-champagne focus:border-gold focus:ring-gold/20"
                />
              </label>

              {error && (
                <p className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-xs text-clay-light">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={submitting || password.length < 12 || confirmPassword.length < 12}
                className="w-full bg-gold text-espresso hover:bg-gold-light disabled:opacity-40"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                Save new password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
