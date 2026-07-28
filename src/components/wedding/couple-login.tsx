'use client'

import { useState, useEffect } from 'react'
import { Lock, LogIn, LogOut, Pencil, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { isAdminLoggedIn, setAdminLoggedIn, logoutAdmin, verifyAdmin } from '@/lib/admin-auth'
import { useWewedStore } from '@/lib/store'

/**
 * CoupleLogin — floating button for the couple to login and edit content.
 *
 * Uses the ZUSTAND STORE's editMode (not local state) so that InlineEditButton
 * components across the site can react to edit mode changes.
 *
 * When editMode is ON:
 * - Gold pencil icons appear next to editable text (names, dates, stories, etc.)
 * - A visible "EDIT MODE" banner appears at the top of the page
 * - Clicking any pencil opens a dialog to edit that specific text
 */
export function CoupleLogin() {
  const [showLogin, setShowLogin] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)

  // Use the ZUSTAND STORE's editMode — this is shared with InlineEditButton
  const editMode = useWewedStore((s) => s.editMode)
  const setEditMode = useWewedStore((s) => s.setEditMode)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoggedIn(isAdminLoggedIn())
  }, [])

  const handleLogin = () => {
    if (verifyAdmin(password)) {
      setAdminLoggedIn()
      setLoggedIn(true)
      setShowLogin(false)
      setPassword('')
      setEditMode(true) // This sets the STORE's editMode — InlineEditButton will react
      toast.success('Edit mode is ON! Look for gold pencil icons next to editable text.', {
        description: 'Click any pencil to edit that section.',
        duration: 5000,
      })
    } else {
      toast.error('Incorrect password', {
        description: 'Please check your password and try again.',
      })
    }
  }

  const handleLogout = () => {
    logoutAdmin()
    setLoggedIn(false)
    setEditMode(false)
    toast.info('Logged out. Edit mode disabled.')
  }

  const toggleEditMode = () => {
    setEditMode(!editMode)
    if (!editMode) {
      toast.info('Edit mode ON — look for gold pencil icons to edit text.', {
        description: 'Click any pencil icon to edit that content.',
        duration: 4000,
      })
    } else {
      toast.info('Edit mode OFF')
    }
  }

  return (
    <>
      {/* EDIT MODE BANNER — visible at top of page when editing is active */}
      {loggedIn && editMode && (
        <div className="fixed top-16 left-0 right-0 z-30 bg-gold/90 px-4 py-2 text-center backdrop-blur-sm">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-espresso">
            ✏️ Edit Mode is ON — Click any gold pencil icon to edit text
          </p>
        </div>
      )}

      {/* Floating login/edit button (bottom-left) */}
      {!loggedIn ? (
        <div className="fixed bottom-6 left-6 z-40">
          <Button
            onClick={() => setShowLogin(true)}
            className="group flex items-center gap-2 rounded-full border border-gold/40 bg-espresso/90 px-4 py-2.5 text-champagne shadow-lg backdrop-blur-md transition-all hover:border-gold hover:bg-espresso"
            aria-label="Couple login"
          >
            <Lock className="h-4 w-4 text-gold transition-transform group-hover:scale-110" />
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em]">
              Couple Login
            </span>
          </Button>
        </div>
      ) : (
        <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2">
          <Button
            onClick={toggleEditMode}
            className={`flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-lg backdrop-blur-md transition-all ${
              editMode
                ? 'border-gold bg-gold text-espresso hover:bg-gold/90'
                : 'border-gold/40 bg-espresso/90 text-champagne hover:border-gold hover:bg-espresso'
            }`}
            aria-label={editMode ? 'Turn off edit mode' : 'Turn on edit mode'}
          >
            <Pencil className={`h-4 w-4 ${editMode ? 'text-espresso' : 'text-gold'}`} />
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em]">
              {editMode ? 'Editing' : 'Edit'}
            </span>
            {editMode && (
              <span className="ml-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-espresso/50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-espresso" />
              </span>
            )}
          </Button>

          <Button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-full border border-gold/40 bg-espresso/90 px-3 py-2.5 text-champagne shadow-lg backdrop-blur-md transition-all hover:border-clay hover:bg-espresso hover:text-clay"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4 text-gold/70" />
          </Button>
        </div>
      )}

      {/* Login Dialog */}
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
              Log in to edit your wedding website content, stories, and details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="couple-password" className="text-xs font-semibold uppercase tracking-[0.15em] text-espresso/70">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="couple-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Enter your password"
                  className="border-gold/30 bg-white/60 pr-10 text-espresso placeholder:text-espresso/40 focus:border-gold focus:ring-gold/20"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-espresso/40 hover:text-gold"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gold/20 bg-gold/5 p-3">
              <p className="text-center font-sans text-[11px] text-espresso/50">
                Demo password: <code className="rounded bg-gold/10 px-1.5 py-0.5 font-mono text-gold">wewed-admin-2026</code>
              </p>
            </div>

            <Button
              onClick={handleLogin}
              disabled={!password}
              className="w-full bg-gold text-espresso hover:bg-gold/90 disabled:opacity-40"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Log In &amp; Start Editing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
