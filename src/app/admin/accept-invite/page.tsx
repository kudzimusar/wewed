'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'

type InvitationState = 'checking' | 'ready' | 'invalid' | 'complete'

type AddressMetadata = {
  line1?: unknown
  line2?: unknown
  city?: unknown
  state_province?: unknown
  postal_code?: unknown
  country?: unknown
}

type AdministratorMetadata = {
  alternate_emails?: unknown
  phone?: unknown
  address?: unknown
  certificates?: unknown
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function list(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function splitEntries(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,;]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export default function AcceptAdministratorInvitePage() {
  const supabase = useMemo(() => createClient(), [])
  const [state, setState] = useState<InvitationState>('checking')
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [alternateEmails, setAlternateEmails] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [stateProvince, setStateProvince] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('')
  const [certificates, setCertificates] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function establishInvitationSession() {
      try {
        const query = new URLSearchParams(window.location.search)
        const code = query.get('code')
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const accessToken = hash.get('access_token')
        const refreshToken = hash.get('refresh_token')

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (sessionError) throw sessionError
        }

        if (window.location.search || window.location.hash) {
          window.history.replaceState(null, '', '/admin/accept-invite')
        }

        const { data, error: sessionError } = await supabase.auth.getSession()
        const session = data.session
        if (sessionError || !session?.user) throw sessionError || new Error('No session')
        if (cancelled) return

        const userMetadata = record(session.user.user_metadata)
        const administratorProfile = record(
          userMetadata.administrator_profile,
        ) as AdministratorMetadata
        const address = record(administratorProfile.address) as AddressMetadata

        setEmail(session.user.email || '')
        setFullName(text(userMetadata.display_name))
        setPhone(text(administratorProfile.phone))
        setAlternateEmails(
          list(administratorProfile.alternate_emails).join(', '),
        )
        setAddressLine1(text(address.line1))
        setAddressLine2(text(address.line2))
        setCity(text(address.city))
        setStateProvince(text(address.state_province))
        setPostalCode(text(address.postal_code))
        setCountry(text(address.country))
        setCertificates(list(administratorProfile.certificates).join('\n'))
        setState('ready')
      } catch (caught) {
        console.error('[admin/invite] Unable to establish invitation session:', caught)
        if (!cancelled) setState('invalid')
      }
    }

    void establishInvitationSession()

    return () => {
      cancelled = true
    }
  }, [supabase])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError('Enter your full name before accepting the invitation.')
      return
    }
    if (password.length < 12) {
      setError('Use at least 12 characters for your password.')
      return
    }
    if (password !== confirmPassword) {
      setError('The two password entries do not match.')
      return
    }

    setSubmitting(true)

    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
        data: { display_name: fullName.trim() },
      })
      if (passwordError) throw passwordError

      const { data, error: sessionError } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (sessionError || !accessToken) {
        throw sessionError || new Error('Invitation session expired.')
      }

      const response = await fetch('/api/admin/invitations/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone,
          alternateEmails: splitEntries(alternateEmails),
          addressLine1,
          addressLine2,
          city,
          stateProvince,
          postalCode,
          country,
          certificates: splitEntries(certificates),
        }),
      })
      const payload = (await response.json()) as {
        success?: boolean
        error?: string
      }
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Unable to accept this invitation.')
      }

      await supabase.auth.signOut({ scope: 'local' })
      setPassword('')
      setConfirmPassword('')
      setState('complete')
    } catch (caught) {
      console.error('[admin/invite] Unable to accept invitation:', caught)
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to accept this invitation. Request a new email and try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-espresso px-5 py-12 text-champagne sm:py-20">
      <Card className="mx-auto w-full max-w-3xl border-gold/25 bg-white/[0.035] text-champagne shadow-2xl">
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
                <UserCheck className="size-7" />
              )}
            </div>
            <p className="wewed-monogram mt-5 text-xs tracking-[0.3em]">
              WEWED · ADMINISTRATOR ACCESS
            </p>
            <h1 className="wewed-heading mt-3 text-3xl text-champagne">
              {state === 'checking'
                ? 'Verifying invitation'
                : state === 'complete'
                  ? 'Invitation accepted'
                  : state === 'invalid'
                    ? 'Invitation unavailable'
                    : 'Complete your administrator profile'}
            </h1>
          </div>

          {state === 'checking' && (
            <p className="mt-7 text-center text-sm leading-6 text-champagne/60">
              Wewed is validating the secure invitation and removing sensitive
              tokens from the address bar.
            </p>
          )}

          {state === 'invalid' && (
            <div className="mt-7 space-y-5 text-center">
              <p className="text-sm leading-6 text-champagne/65">
                This invitation is invalid, expired, already used, or has been
                replaced. Ask a Wewed Super Admin to send a new invitation.
              </p>
              <Button asChild className="w-full bg-gold text-espresso hover:bg-gold-light">
                <Link href="/">Return to Wewed</Link>
              </Button>
            </div>
          )}

          {state === 'complete' && (
            <div className="mt-7 space-y-5 text-center">
              <p className="text-sm leading-6 text-champagne/65">
                Your profile is complete and your Wewed platform role is active.
                Sign in with your email and the password you just created.
              </p>
              <Button asChild className="w-full bg-gold text-espresso hover:bg-gold-light">
                <Link href="/admin">Sign in to Wewed Admin</Link>
              </Button>
            </div>
          )}

          {state === 'ready' && (
            <form onSubmit={submit} className="mt-8 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Primary email
                  </span>
                  <Input
                    value={email}
                    readOnly
                    className="border-gold/20 bg-black/20 text-champagne/70"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Full name
                  </span>
                  <Input
                    value={fullName}
                    onChange={(event) => {
                      setFullName(event.target.value)
                      setError(null)
                    }}
                    required
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Phone number
                  </span>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Alternate email addresses
                  </span>
                  <Input
                    value={alternateEmails}
                    onChange={(event) => setAlternateEmails(event.target.value)}
                    placeholder="Separate addresses with commas"
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Address line 1
                  </span>
                  <Input
                    value={addressLine1}
                    onChange={(event) => setAddressLine1(event.target.value)}
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Address line 2
                  </span>
                  <Input
                    value={addressLine2}
                    onChange={(event) => setAddressLine2(event.target.value)}
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    City
                  </span>
                  <Input
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    State / province
                  </span>
                  <Input
                    value={stateProvince}
                    onChange={(event) => setStateProvince(event.target.value)}
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Postal code
                  </span>
                  <Input
                    value={postalCode}
                    onChange={(event) => setPostalCode(event.target.value)}
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Country
                  </span>
                  <Input
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Certificates and credentials
                  </span>
                  <Textarea
                    value={certificates}
                    onChange={(event) => setCertificates(event.target.value)}
                    placeholder="Enter one certificate or credential per line"
                    className="min-h-28 border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
              </div>

              <div className="grid gap-4 border-t border-gold/15 pt-6 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Create password
                  </span>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold/50" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setError(null)
                      }}
                      autoComplete="new-password"
                      minLength={12}
                      required
                      className="border-gold/30 bg-espresso/60 pl-10 pr-10 text-champagne"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/50 transition hover:text-gold"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </label>
                <label className="space-y-2">
                  <span className="text-xs uppercase tracking-[0.16em] text-gold-muted">
                    Confirm password
                  </span>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                      setError(null)
                    }}
                    autoComplete="new-password"
                    minLength={12}
                    required
                    className="border-gold/30 bg-espresso/60 text-champagne"
                  />
                </label>
              </div>

              <p className="text-xs leading-5 text-champagne/45">
                Use at least 12 characters. Your role remains pending until this
                form is submitted successfully.
              </p>

              {error && (
                <p className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-xs text-clay-light">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={
                  submitting ||
                  !fullName.trim() ||
                  password.length < 12 ||
                  confirmPassword.length < 12
                }
                className="w-full bg-gold text-espresso hover:bg-gold-light disabled:opacity-40"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserCheck className="size-4" />
                )}
                Accept invitation and activate account
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
