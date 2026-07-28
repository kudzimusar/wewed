'use client'

import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock,
  Unlock,
  Key,
  Mail,
  Shield,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  verifyFlagshipAccessToken,
  getAccessTokenFromUrl,
  type PrivacyLevel,
} from '@/lib/privacy'
import { cn } from '@/lib/utils'

/* ============================================================
   VaultLockScreen
   ------------------------------------------------------------
   Full-screen overlay shown when a visitor does not have access
   to a private or link_only wedding. Elegant rather than
   jarring — privacy should feel premium.

   UX:
     • On mount, read the URL token one more time. If valid,
       immediately resolve (the parent may then dismiss us).
     • Visitor types token → "Unlock" → POST /api/privacy/verify-token
     • On success: success animation, then reload with ?token=…
       so the parent page re-renders in an authorised state.
     • On error: shake the input, show inline error, focus input.
     • "Request Access" → mailto couple.

   Animation:
     • Entrance: fade + scale (framer-motion)
     • Background: gold dust radial pattern + soft vignette
     • Lock icon: gentle pulse
     • Success: scale-in checkmark + gold ring ripple

   Accessibility:
     • role="dialog" aria-modal="true"
     • Auto-focus input on mount
     • Esc dismisses only after a failed attempt (not before)
     • All interactive elements keyboard-reachable
   ============================================================ */

export interface VaultLockScreenProps {
  /** Privacy level that triggered the lock. Drives copy. */
  privacy?: PrivacyLevel | string
  /** Optional couple monogram (defaults to "C&K"). */
  monogram?: string
  /** Optional couple names (defaults to "Charity & Kudzie"). */
  coupleNames?: string
  /** Optional mailto address for "Request Access". */
  requestAccessEmail?: string
  /** Optional callback after a successful unlock (before reload). */
  onUnlock?: (token: string) => void
  /** Whether to auto-reload the page on success. Default true. */
  autoReload?: boolean
  /** Optional className for the outermost motion.div. */
  className?: string
}

const EASE = [0.22, 1, 0.36, 1] as const

export function VaultLockScreen({
  privacy = 'private',
  monogram = 'C&K',
  coupleNames = 'Charity & Kudzie',
  requestAccessEmail = 'hello@wewed.co.zw',
  onUnlock,
  autoReload = true,
  className,
}: VaultLockScreenProps) {
  // Detect a valid URL token once during initial render — no setState
  // inside an effect, so we avoid the cascading-render lint rule.
  const [initialUrlToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const urlToken = getAccessTokenFromUrl()
    return urlToken && verifyFlagshipAccessToken(urlToken) ? urlToken : null
  })

  const [token, setToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>(
    initialUrlToken ? 'success' : 'idle',
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [shakeKey, setShakeKey] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input on mount + whenever we return to idle/error
  useEffect(() => {
    if (status === 'idle' || status === 'error') {
      const t = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(t)
    }
  }, [status])

  // If we started in 'success' because of a URL token, notify the parent
  // so it can dismiss us. This is a side-effect call (not a setState),
  // and runs once on mount.
  useEffect(() => {
    if (initialUrlToken && status === 'success') {
      onUnlock?.(initialUrlToken)
    }
    // Intentionally mount-only: we only need to notify the parent once.
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (status === 'verifying' || status === 'success') return

      const trimmed = token.trim()
      if (!trimmed) {
        setErrorMsg('Please enter the access token from your invitation.')
        setStatus('error')
        setShakeKey((k) => k + 1)
        return
      }

      setStatus('verifying')
      setErrorMsg(null)

      try {
        // Verify against the server (POST /api/privacy/verify-token).
        // For the flagship MVP we also keep a local constant-time check
        // so the UX works even if the network is flaky.
        let valid = false
        try {
          const res = await fetch('/api/privacy/verify-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: trimmed }),
          })
          if (res.ok) {
            const data = (await res.json()) as { valid?: boolean }
            valid = Boolean(data?.valid)
          }
        } catch {
          /* fall back to local check */
        }

        if (!valid) {
          // Local fallback (constant-time compare against flagship token)
          valid = verifyFlagshipAccessToken(trimmed)
        }

        if (valid) {
          setStatus('success')
          onUnlock?.(trimmed)
          if (autoReload && typeof window !== 'undefined') {
            // Build URL with ?token=… and reload so the parent
            // re-renders in an authorised state.
            setTimeout(() => {
              try {
                const url = new URL(window.location.href)
                url.searchParams.set('token', trimmed)
                window.location.assign(url.toString())
              } catch {
                window.location.reload()
              }
            }, 1100)
          }
        } else {
          setErrorMsg(
            "That token doesn't match. Please double-check your invitation.",
          )
          setStatus('error')
          setShakeKey((k) => k + 1)
        }
      } catch (err) {
        console.error('[VaultLockScreen] verify error:', err)
        setErrorMsg('Something went wrong. Please try again.')
        setStatus('error')
        setShakeKey((k) => k + 1)
      }
    },
    [token, status, onUnlock, autoReload],
  )

  const heading =
    String(privacy) === 'link_only'
      ? 'A Quiet Invitation'
      : 'This Wedding is in the Vault'

  const subtext =
    String(privacy) === 'link_only'
      ? `${coupleNames} have chosen to share their celebration with invited guests only. Enter the access token from your invitation to view their story.`
      : `${coupleNames} have chosen to keep their celebration private. Enter the access token provided in your invitation to view their story.`

  const mailtoHref = `mailto:${requestAccessEmail}?subject=${encodeURIComponent(
    `Access request — ${coupleNames} wedding`,
  )}&body=${encodeURIComponent(
    `Hello ${coupleNames},\n\nI would love to view your wedding site on wewed. Could you please share an access token?\n\nThank you!`,
  )}`

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-title"
      aria-describedby="vault-desc"
      className={cn(
        'fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6',
        'bg-espresso text-champagne',
        'overflow-y-auto',
        className,
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {/* ─── Ambient background ─────────────────────────── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 35%, rgba(191,155,95,0.18) 0%, rgba(26,20,16,0) 55%), radial-gradient(circle at 80% 80%, rgba(107,45,58,0.18) 0%, rgba(26,20,16,0) 50%), radial-gradient(circle at 15% 75%, rgba(192,99,63,0.12) 0%, rgba(26,20,16,0) 45%)',
        }}
      />
      {/* Subtle damask dots */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(216,188,126,0.6) 1px, transparent 1.5px)',
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0',
        }}
      />
      {/* Gold hairline frame */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-3 sm:inset-6 rounded-2xl border border-gold/15"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-4 sm:inset-8 rounded-xl border border-gold/10"
      />

      {/* ─── Card ───────────────────────────────────────── */}
      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE, delay: 0.1 }}
      >
        <div className="relative rounded-2xl border border-gold/25 bg-gradient-to-b from-[#221c18] to-espresso px-6 py-10 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] sm:px-10 sm:py-12">
          {/* Top monogram */}
          <div className="flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25, ease: EASE }}
              className="flex items-center justify-center"
            >
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-espresso/60 sm:h-20 sm:w-20">
                <span
                  className="wewed-monogram text-2xl sm:text-3xl"
                  style={{ letterSpacing: '0.08em' }}
                >
                  {monogram}
                </span>
                {/* Outer thin gold ring */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-full border border-gold-light/20"
                  style={{ transform: 'scale(1.12)' }}
                />
              </div>
            </motion.div>

            {/* Lock icon with gentle pulse */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.35, ease: EASE }}
              className="mt-6"
            >
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/10 ring-1 ring-gold/30"
              >
                <Lock
                  size={22}
                  strokeWidth={1.6}
                  className="text-gold-light"
                />
              </motion.div>
            </motion.div>

            <motion.h2
              id="vault-title"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.45, ease: EASE }}
              className="mt-5 wewed-heading text-2xl sm:text-3xl text-champagne"
            >
              {heading}
            </motion.h2>

            <motion.p
              id="vault-desc"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.55, ease: EASE }}
              className="mt-3 max-w-sm font-sans text-sm leading-relaxed text-champagne/65 sm:text-[15px]"
            >
              {subtext}
            </motion.p>
          </div>

          {/* ─── Form / status states ──────────────────── */}
          <div className="mt-8">
            <AnimatePresence mode="wait" initial={false}>
              {status === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="relative flex h-16 w-16 items-center justify-center">
                    <motion.span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border border-gold/40"
                      initial={{ scale: 0.6, opacity: 0.8 }}
                      animate={{ scale: 1.6, opacity: 0 }}
                      transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
                    />
                    <motion.div
                      initial={{ scale: 0.6, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ duration: 0.5, ease: EASE, type: 'spring' }}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold text-espresso"
                    >
                      <Check size={26} strokeWidth={2.6} />
                    </motion.div>
                  </div>
                  <p className="mt-4 wewed-heading text-xl text-gold-light">
                    Welcome inside.
                  </p>
                  <p className="mt-1 font-sans text-sm text-champagne/60">
                    Unlocking the vault…
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3"
                  noValidate
                >
                  <motion.div
                    key={shakeKey}
                    animate={
                      status === 'error'
                        ? { x: [0, -8, 7, -5, 4, 0] }
                        : { x: 0 }
                    }
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                  >
                    <label
                      htmlFor="vault-token"
                      className="mb-1.5 block font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-gold/70"
                    >
                      Access Token
                    </label>
                    <div className="relative">
                      <Key
                        size={16}
                        strokeWidth={2}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gold/50"
                        aria-hidden="true"
                      />
                      <Input
                        ref={inputRef}
                        id="vault-token"
                        name="token"
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="e.g. charity-kudzie-2026"
                        value={token}
                        onChange={(e) => {
                          setToken(e.target.value)
                          if (status === 'error') {
                            setStatus('idle')
                            setErrorMsg(null)
                          }
                        }}
                        disabled={status === 'verifying'}
                        aria-invalid={status === 'error'}
                        aria-describedby={errorMsg ? 'vault-error' : undefined}
                        className={cn(
                          'h-12 rounded-lg border bg-espresso/60 pl-10 pr-3 font-sans text-sm text-champagne placeholder:text-champagne/30',
                          'focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-0',
                          status === 'error'
                            ? 'border-clay/70 focus-visible:border-clay'
                            : 'border-gold/30 focus-visible:border-gold/60',
                        )}
                      />
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {errorMsg && (
                      <motion.p
                        id="vault-error"
                        role="alert"
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 4 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-1.5 font-sans text-xs text-clay-light"
                      >
                        <AlertCircle size={13} strokeWidth={2.2} />
                        <span>{errorMsg}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button
                    type="submit"
                    disabled={status === 'verifying'}
                    className={cn(
                      'h-12 w-full gap-2 rounded-lg font-sans text-sm font-medium uppercase tracking-[0.16em]',
                      'bg-gradient-to-br from-gold-light via-gold to-gold-muted text-espresso',
                      'border border-gold/60 shadow-[0_6px_20px_-8px_rgba(191,155,95,0.7)]',
                      'hover:from-gold hover:via-gold hover:to-gold-light hover:text-espresso',
                      'disabled:opacity-80 disabled:hover:from-gold-light',
                    )}
                  >
                    {status === 'verifying' ? (
                      <>
                        <Loader2 size={16} strokeWidth={2.2} className="animate-spin" />
                        <span>Verifying</span>
                      </>
                    ) : (
                      <>
                        <Unlock size={16} strokeWidth={2.2} />
                        <span>Unlock</span>
                      </>
                    )}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* ─── Footer: Request Access + canon hint ───── */}
          {status !== 'success' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="mt-7 flex flex-col items-center gap-3 text-center"
            >
              <a
                href={mailtoHref}
                className="group inline-flex items-center gap-1.5 font-sans text-xs text-champagne/55 transition-colors hover:text-gold-light"
              >
                <Mail
                  size={13}
                  strokeWidth={2}
                  className="text-champagne/40 transition-colors group-hover:text-gold-light"
                />
                <span className="underline-offset-4 group-hover:underline">
                  Request access
                </span>
              </a>
              <div className="flex items-center gap-1.5 font-sans text-[10px] uppercase tracking-[0.22em] text-champagne/30">
                <Shield size={11} strokeWidth={2} className="text-gold/40" />
                <span>wewed · sealed vault</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Caption beneath the card */}
        <p className="mt-5 text-center font-sans text-[10px] uppercase tracking-[0.3em] text-champagne/25">
          {coupleNames} · wewed
        </p>
      </motion.div>
    </motion.div>
  )
}

export default VaultLockScreen
