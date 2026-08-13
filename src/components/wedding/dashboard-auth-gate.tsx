'use client'

import Link from 'next/link'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff, Loader2, Lock, LogOut, Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  ADMIN_AUTH_EVENT,
  getCachedDashboardUser,
  logoutAdmin,
  refreshAdminSession,
  signInAdmin,
  type DashboardRole,
  type DashboardUser,
  type DashboardWeddingRole,
} from '@/lib/admin-auth'

interface DashboardAuthGateProps {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
  allowedRoles?: readonly DashboardRole[]
  allowedWeddingRoles?: readonly DashboardWeddingRole[]
  wrongRoleMessage?: string
}

type AuthState = 'checking' | 'signed-out' | 'authorized' | 'wrong-role'

function roleIsAllowed(
  user: DashboardUser | null | undefined,
  allowedRoles: readonly DashboardRole[] | undefined,
  allowedWeddingRoles: readonly DashboardWeddingRole[] | undefined,
): boolean {
  if (!user) return false
  if (!allowedRoles && !allowedWeddingRoles) return true

  const globalRoleAllowed = allowedRoles?.includes(user.role) ?? false
  const weddingRoleAllowed = user.activeWeddingRole
    ? allowedWeddingRoles?.includes(user.activeWeddingRole) ?? false
    : false

  return globalRoleAllowed || weddingRoleAllowed
}

export function DashboardAuthGate({
  title,
  description,
  onClose,
  children,
  allowedRoles,
  allowedWeddingRoles,
  wrongRoleMessage = 'This page requires a different Wewed workspace. Switch accounts to continue.',
}: DashboardAuthGateProps) {
  const [authState, setAuthState] = useState<AuthState>('checking')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const handleAuthChange = (event: Event) => {
      const authorized = (event as CustomEvent<{ authorized?: boolean }>).detail
        ?.authorized
      if (!authorized) {
        setAuthState('signed-out')
        return
      }

      const user = getCachedDashboardUser()
      setAuthState(
        roleIsAllowed(user, allowedRoles, allowedWeddingRoles)
          ? 'authorized'
          : 'wrong-role',
      )
    }

    window.addEventListener(ADMIN_AUTH_EVENT, handleAuthChange)

    void refreshAdminSession().then((result) => {
      if (cancelled) return
      if (!result.success || !result.user) {
        setAuthState('signed-out')
        return
      }
      setAuthState(
        roleIsAllowed(result.user, allowedRoles, allowedWeddingRoles)
          ? 'authorized'
          : 'wrong-role',
      )
    })

    return () => {
      cancelled = true
      window.removeEventListener(ADMIN_AUTH_EVENT, handleAuthChange)
    }
  }, [allowedRoles, allowedWeddingRoles])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await signInAdmin(email, password)

    if (result.success && result.user) {
      setPassword('')
      setAuthState(
        roleIsAllowed(result.user, allowedRoles, allowedWeddingRoles)
          ? 'authorized'
          : 'wrong-role',
      )
    } else {
      setError(result.error || 'Unable to sign in.')
    }

    setSubmitting(false)
  }

  function switchAccount() {
    logoutAdmin()
    setPassword('')
    setError(null)
    setAuthState('signed-out')
  }

  if (authState === 'authorized') return children

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className="w-[94vw] max-w-md border-gold/30 bg-espresso p-0 text-champagne"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 inline-flex size-9 items-center justify-center rounded-full border border-gold/20 text-champagne/70 transition-colors hover:bg-gold/10 hover:text-gold"
        >
          <X className="size-4" />
        </button>

        <Card className="border-0 bg-transparent p-8 shadow-none">
          <CardContent className="px-0">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                {authState === 'checking' ? (
                  <Loader2 className="size-6 animate-spin text-gold" />
                ) : authState === 'wrong-role' ? (
                  <LogOut className="size-6 text-gold" />
                ) : (
                  <Lock className="size-6 text-gold" />
                )}
              </div>
              <p className="wewed-monogram text-xs tracking-[0.3em]">
                WEWED · SECURE ACCESS
              </p>
              <h2 className="wewed-heading mt-3 text-3xl text-champagne">
                {authState === 'wrong-role' ? 'Switch Wewed account' : title}
              </h2>
              <p className="mt-2 font-sans text-sm text-champagne/60">
                {authState === 'checking'
                  ? 'Checking your secure session…'
                  : authState === 'wrong-role'
                    ? wrongRoleMessage
                    : description}
              </p>
            </div>

            {authState === 'wrong-role' && (
              <div className="space-y-4">
                <Button
                  type="button"
                  onClick={switchAccount}
                  className="w-full bg-gold font-sans text-espresso hover:bg-gold-light"
                >
                  <LogOut className="size-4" />
                  Switch account
                </Button>
                <p className="text-center font-sans text-[11px] text-champagne/45">
                  Your current Wewed session will be signed out before another account signs in.
                </p>
              </div>
            )}

            {authState === 'signed-out' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="dashboard-email"
                    className="font-sans text-xs uppercase tracking-[0.18em] text-gold-muted"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold/50" />
                    <Input
                      id="dashboard-email"
                      type="email"
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        setError(null)
                      }}
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      className="border-gold/30 bg-espresso/60 pl-10 font-sans text-champagne placeholder:text-champagne/30 focus:border-gold focus:ring-gold/20"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label
                      htmlFor="dashboard-password"
                      className="font-sans text-xs uppercase tracking-[0.18em] text-gold-muted"
                    >
                      Password
                    </label>
                    <Link
                      href={`/forgot-password${email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
                      className="font-sans text-xs text-gold transition hover:text-gold-light"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gold/50" />
                    <Input
                      id="dashboard-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        setError(null)
                      }}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="border-gold/30 bg-espresso/60 pl-10 pr-10 font-sans text-champagne placeholder:text-champagne/30 focus:border-gold focus:ring-gold/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gold/50 transition-colors hover:text-gold"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <p className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 font-sans text-xs text-clay-light">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={!email.trim() || !password || submitting}
                  className="w-full bg-gold font-sans text-espresso hover:bg-gold-light disabled:opacity-40"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Lock className="size-4" />
                  )}
                  Sign In Securely
                </Button>

                <p className="text-center font-sans text-[11px] text-champagne/45">
                  Access is invite-only. Use the email and password assigned to
                  your Wewed account.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  )
}