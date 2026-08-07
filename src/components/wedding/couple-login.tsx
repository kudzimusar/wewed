'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  BriefcaseBusiness,
  Eye,
  EyeOff,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  logoutAdmin,
  refreshAdminSession,
  signInAdmin,
  type DashboardRole,
} from '@/lib/admin-auth'
import { useWewedStore } from '@/lib/store'
import type { PublicWeddingAccessKind } from '@/components/wedding/wedding-home'

const navigationByRole: Record<
  DashboardRole,
  { href: string; label: string; icon: typeof LayoutDashboard }
> = {
  couple: {
    href: '/couple',
    label: 'Couple dashboard',
    icon: LayoutDashboard,
  },
  planner: {
    href: '/planner',
    label: 'Planner workspace',
    icon: BriefcaseBusiness,
  },
  admin: {
    href: '/admin',
    label: 'Admin console',
    icon: ShieldCheck,
  },
}

export function CoupleLogin({
  accessKind,
}: {
  accessKind: PublicWeddingAccessKind
}) {
  const serverConfirmedMember =
    accessKind === 'couple_owner' || accessKind === 'wedding_member'
  const serverConfirmedOwner = accessKind === 'couple_owner'

  const [showLogin, setShowLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loggedIn, setLoggedIn] = useState(serverConfirmedMember)
  const [dashboardRole, setDashboardRole] = useState<DashboardRole | null>(
    serverConfirmedOwner ? 'couple' : null,
  )
  const [checking, setChecking] = useState(!serverConfirmedMember)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const editMode = useWewedStore((state) => state.editMode)
  const setEditMode = useWewedStore((state) => state.setEditMode)

  useEffect(() => {
    let cancelled = false

    void refreshAdminSession().then((result) => {
      if (cancelled) return

      if (result.success && result.user && serverConfirmedMember) {
        setLoggedIn(true)
        setDashboardRole(result.user.role)
      } else if (!serverConfirmedMember) {
        setLoggedIn(false)
        setDashboardRole(null)
      }
      setChecking(false)
    })

    return () => {
      cancelled = true
    }
  }, [serverConfirmedMember])

  async function handleLogin() {
    setSubmitting(true)
    setError(null)

    const result = await signInAdmin(email, password)

    if (result.success) {
      setPassword('')
      setShowLogin(false)
      toast.success('Signed in. Checking access to this wedding…')
      window.location.reload()
      return
    }

    setError(result.error || 'Unable to sign in.')
    toast.error('Sign in failed', {
      description: result.error || 'Check your account details and try again.',
    })
    setSubmitting(false)
  }

  function handleLogout() {
    logoutAdmin()
    setLoggedIn(false)
    setDashboardRole(null)
    setEditMode(false)
    toast.info('Signed out. Edit mode disabled.')
  }

  function toggleEditMode() {
    setEditMode(!editMode)

    if (!editMode) {
      toast.info('Edit mode ON — look for gold pencil icons.', {
        description: 'Click any pencil icon to edit that content.',
        duration: 4000,
      })
    } else {
      toast.info('Edit mode OFF')
    }
  }

  const navigation = dashboardRole ? navigationByRole[dashboardRole] : null
  const NavigationIcon = navigation?.icon ?? LayoutDashboard

  return (
    <>
      {serverConfirmedOwner && loggedIn && editMode && (
        <div className="fixed left-0 right-0 top-16 z-30 bg-gold/90 px-4 py-2 text-center backdrop-blur-sm">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-espresso">
            ✏️ Edit Mode is ON — Click any gold pencil icon to edit text
          </p>
        </div>
      )}

      {!checking && !loggedIn ? (
        <div className="fixed bottom-6 left-6 z-40">
          <Button
            onClick={() => setShowLogin(true)}
            className="group flex min-h-11 items-center gap-2 rounded-full border border-gold/40 bg-espresso/90 px-4 py-2.5 text-champagne shadow-lg backdrop-blur-md transition-all hover:border-gold hover:bg-espresso"
            aria-label="Couple login"
          >
            <Lock className="h-4 w-4 text-gold transition-transform group-hover:scale-110" />
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em]">
              Couple Login
            </span>
          </Button>
        </div>
      ) : loggedIn ? (
        <div className="fixed bottom-6 left-6 z-40 flex max-w-[calc(100vw-3rem)] flex-wrap items-center gap-2">
          {navigation && (
            <Link
              href={navigation.href}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/40 bg-espresso/95 px-4 py-2.5 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-champagne shadow-lg backdrop-blur-md transition hover:border-gold hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label={navigation.label}
            >
              <NavigationIcon className="h-4 w-4 text-gold" />
              {navigation.label}
            </Link>
          )}

          {serverConfirmedOwner && dashboardRole === 'couple' && (
            <Button
              onClick={toggleEditMode}
              className={`flex min-h-11 items-center gap-2 rounded-full border px-4 py-2.5 shadow-lg backdrop-blur-md transition-all ${
                editMode
                  ? 'border-gold bg-gold text-espresso hover:bg-gold/90'
                  : 'border-gold/40 bg-espresso/95 text-champagne hover:border-gold hover:bg-espresso'
              }`}
              aria-label={editMode ? 'Turn off edit mode' : 'Turn on edit mode'}
            >
              <Pencil className={`h-4 w-4 ${editMode ? 'text-espresso' : 'text-gold'}`} />
              <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em]">
                {editMode ? 'Editing' : 'Edit'}
              </span>
            </Button>
          )}

          <Button
            onClick={handleLogout}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-gold/40 bg-espresso/95 px-3 py-2.5 text-champagne shadow-lg backdrop-blur-md transition-all hover:border-clay hover:bg-espresso hover:text-clay"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4 text-gold/70" />
          </Button>
        </div>
      ) : null}

      <Dialog open={showLogin} onOpenChange={setShowLogin}>
        <DialogContent className="max-w-md border-gold/30 bg-champagne">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold/30 bg-gold/10">
              <Lock className="h-7 w-7 text-gold" />
            </div>
            <DialogTitle className="text-center font-serif text-2xl font-light text-espresso">
              Couple Login
            </DialogTitle>
            <DialogDescription className="text-center text-espresso/60">
              Sign in with an invited Wewed account. Access to this wedding is verified after sign-in.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4 py-2"
            onSubmit={(event) => {
              event.preventDefault()
              void handleLogin()
            }}
          >
            <div className="space-y-2">
              <Label
                htmlFor="couple-email"
                className="text-xs font-semibold uppercase tracking-[0.15em] text-espresso/70"
              >
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso/40" />
                <Input
                  id="couple-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError(null)
                  }}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  className="border-gold/30 bg-white/60 pl-10 text-espresso placeholder:text-espresso/40 focus:border-gold focus:ring-gold/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="couple-password"
                className="text-xs font-semibold uppercase tracking-[0.15em] text-espresso/70"
              >
                Password
              </Label>
              <div className="relative">
                <Input
                  id="couple-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError(null)
                  }}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="border-gold/30 bg-white/60 pr-10 text-espresso placeholder:text-espresso/40 focus:border-gold focus:ring-gold/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 min-h-11 min-w-11 -translate-y-1/2 text-espresso/40 hover:text-gold"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="mx-auto h-4 w-4" />
                  ) : (
                    <Eye className="mx-auto h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-clay/30 bg-clay/10 px-3 py-2 text-xs text-clay">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={!email.trim() || !password || submitting}
              className="min-h-11 w-full bg-gold text-espresso hover:bg-gold/90 disabled:opacity-40"
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Sign in
            </Button>

            <p className="text-center font-sans text-[11px] text-espresso/50">
              Access is invite-only. The server verifies that this account belongs to this wedding before showing management controls.
            </p>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
