'use client'

/* ============================================================
   admin-auth.ts — Lightweight admin gate for the couple
   ------------------------------------------------------------
   This is a *flagship-MVP* auth: a single hardcoded password
   for the flagship couple (Charity & Kudzie). It is intentionally
   simple — no NextAuth, no JWTs, no server sessions. The gate is
   purely client-side and persists a flag in localStorage + a
   short-lived cookie so the dashboard survives refreshes.

   For the platform phase (Phase 5), this will be replaced by a
   proper NextAuth.js + credentials provider with hashed passwords
   and per-couple scoping. For now, the wedding is private and
   password-gated, and the admin URL is not advertised.
   ============================================================ */

// --- Admin password ---------------------------------------------------------
// The password can be overridden at build/deploy time via the
// WEWED_ADMIN_PASSWORD env var. Fallback is intentionally weak —
// it only protects a single-couple flagship MVP from casual visitors.
const ADMIN_PASSWORD =
  process.env.NEXT_PUBLIC_WEWED_ADMIN_PASSWORD ?? 'wewed-admin-2026'

// --- Storage keys -----------------------------------------------------------
const STORAGE_KEY = 'wewed:admin-auth'
const COOKIE_KEY = 'wewed_admin_auth'
// Session validity: 8 hours (a full wedding day)
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

interface AdminSession {
  loggedInAt: number
  // A tiny nonce so the flag is not just a literal "true"
  nonce: string
}

// --- Helpers ----------------------------------------------------------------

function readLocalStorage(): AdminSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminSession
    if (!parsed || typeof parsed.loggedInAt !== 'number' || typeof parsed.nonce !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeLocalStorage(session: AdminSession): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* ignore quota / privacy mode */
  }
}

function clearLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function writeCookie(session: AdminSession): void {
  if (typeof document === 'undefined') return
  const expires = new Date(session.loggedInAt + SESSION_TTL_MS).toUTCString()
  // Not HttpOnly — this is a client-side flag. The cookie only signals
  // "the user has authenticated recently"; it carries no authority.
  document.cookie = `${COOKIE_KEY}=${session.nonce}; expires=${expires}; path=/; SameSite=Lax`
}

function clearCookie(): void {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
}

function genNonce(): string {
  // 16 hex chars — enough to avoid a literal "true" flag
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const arr = new Uint8Array(8)
    crypto.getRandomValues(arr)
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return Math.random().toString(16).slice(2, 18).padEnd(16, '0')
}

// --- Public API -------------------------------------------------------------

/**
 * Verify an admin password attempt.
 * Constant-time-ish comparison (lengths differ early — acceptable for MVP).
 */
export function verifyAdmin(password: string): boolean {
  if (typeof password !== 'string' || password.length === 0) return false
  if (password.length !== ADMIN_PASSWORD.length) return false
  let diff = 0
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ ADMIN_PASSWORD.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Is the admin currently logged in (with a non-expired session)?
 */
export function isAdminLoggedIn(): boolean {
  const session = readLocalStorage()
  if (!session) return false
  if (Date.now() - session.loggedInAt > SESSION_TTL_MS) {
    clearLocalStorage()
    clearCookie()
    return false
  }
  return true
}

/**
 * Mark the admin as logged in. Persists to localStorage + a cookie.
 * Returns true on success.
 */
export function setAdminLoggedIn(): boolean {
  const session: AdminSession = {
    loggedInAt: Date.now(),
    nonce: genNonce(),
  }
  writeLocalStorage(session)
  writeCookie(session)
  return true
}

/**
 * Clear the admin session — logs the couple out.
 */
export function logoutAdmin(): void {
  clearLocalStorage()
  clearCookie()
}

/**
 * The remaining session time in ms (for surfacing a "session expires soon"
 * hint in the dashboard). Returns 0 if not logged in or expired.
 */
export function adminSessionRemainingMs(): number {
  const session = readLocalStorage()
  if (!session) return 0
  const remaining = SESSION_TTL_MS - (Date.now() - session.loggedInAt)
  return Math.max(0, remaining)
}

export const ADMIN_SESSION_TTL_MS = SESSION_TTL_MS
