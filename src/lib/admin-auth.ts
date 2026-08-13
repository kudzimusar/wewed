'use client'

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000
export const ADMIN_AUTH_EVENT = 'wewed:dashboard-auth-changed'

const STORAGE_KEY = 'wewed:dashboard-session'

export type DashboardRole = 'admin' | 'couple' | 'planner' | 'vendor'
export type DashboardWeddingRole = 'admin' | 'owner' | 'planner' | 'coordinator' | 'viewer'

export interface DashboardUser {
  id: string
  email: string
  displayName: string | null
  role: DashboardRole
  coupleId: string | null
  activeWeddingRole?: DashboardWeddingRole | null
}

interface CachedDashboardSession {
  user: DashboardUser
  expiresAt: number
}

interface AuthResult {
  success: boolean
  user?: DashboardUser
  activeWedding?: { membershipRole?: DashboardWeddingRole | null } | null
  error?: string
}

function notifyAuthState(authorized: boolean): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(ADMIN_AUTH_EVENT, { detail: { authorized } })
  )
}

function readCachedSession(): CachedDashboardSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const session = JSON.parse(raw) as Partial<CachedDashboardSession>
    if (
      !session.user ||
      typeof session.user.id !== 'string' ||
      typeof session.user.email !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return session as CachedDashboardSession
  } catch {
    return null
  }
}

function cacheSession(user: DashboardUser, expiresAt?: number): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        user,
        expiresAt: expiresAt ?? Date.now() + ADMIN_SESSION_TTL_MS,
      } satisfies CachedDashboardSession)
    )
  } catch {
    // The server-side HttpOnly session remains authoritative.
  }

  notifyAuthState(true)
}

function clearCachedSession(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore privacy-mode and storage errors.
  }

  notifyAuthState(false)
}

function withWeddingRole(
  user: DashboardUser,
  activeWedding: AuthResult['activeWedding'],
): DashboardUser {
  return {
    ...user,
    activeWeddingRole: activeWedding?.membershipRole ?? null,
  }
}

export async function signInAdmin(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    })

    const payload = (await response.json()) as AuthResult

    if (!response.ok || !payload.success || !payload.user) {
      clearCachedSession()
      return {
        success: false,
        error: payload.error || 'Unable to sign in.',
      }
    }

    const user = withWeddingRole(payload.user, payload.activeWedding)
    cacheSession(user)
    return { success: true, user, activeWedding: payload.activeWedding }
  } catch {
    clearCachedSession()
    return { success: false, error: 'Unable to reach the sign-in service.' }
  }
}

export async function refreshAdminSession(): Promise<AuthResult> {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      cache: 'no-store',
    })

    const payload = (await response.json()) as {
      success?: boolean
      authorized?: boolean
      user?: DashboardUser | null
      activeWedding?: { membershipRole?: DashboardWeddingRole | null } | null
      expiresAt?: number
      error?: string
    }

    if (
      !response.ok ||
      !payload.success ||
      !payload.authorized ||
      !payload.user
    ) {
      clearCachedSession()
      return { success: false, error: payload.error || 'Sign in is required.' }
    }

    const user = withWeddingRole(payload.user, payload.activeWedding)
    cacheSession(user, payload.expiresAt)
    return { success: true, user, activeWedding: payload.activeWedding }
  } catch {
    clearCachedSession()
    return { success: false, error: 'Unable to verify the current session.' }
  }
}

export function isAdminLoggedIn(): boolean {
  return readCachedSession() !== null
}

export function getCachedDashboardUser(): DashboardUser | null {
  return readCachedSession()?.user ?? null
}

/**
 * Legacy compatibility: a browser password can no longer create a session.
 */
export function verifyAdmin(_password: string): boolean {
  return false
}

/**
 * Legacy compatibility: only signInAdmin/refreshAdminSession may cache access.
 */
export function setAdminLoggedIn(): boolean {
  return false
}

export function logoutAdmin(): void {
  clearCachedSession()

  void fetch('/api/auth/signout', {
    method: 'POST',
    cache: 'no-store',
  }).catch(() => undefined)
}

export function adminSessionRemainingMs(): number {
  const session = readCachedSession()
  return session ? Math.max(0, session.expiresAt - Date.now()) : 0
}