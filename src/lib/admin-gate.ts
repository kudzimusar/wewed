import { NextRequest, NextResponse } from 'next/server'

/**
 * Shared admin authorization gate.
 * 
 * Checks for the `wewed_admin_auth` cookie containing a 16-hex nonce.
 * In development, also accepts `?admin=1` query param for convenience.
 * 
 * This is the single source of truth for admin checks — replaces the
 * duplicated pattern in 8+ route files.
 */
const ADMIN_COOKIE_KEY = 'wewed_admin_auth'
const NONCE_PATTERN = /^[a-f0-9]{16}$/

export function isAdmin(request: NextRequest): boolean {
  const cookie = request.cookies.get(ADMIN_COOKIE_KEY)?.value
  if (cookie && NONCE_PATTERN.test(cookie)) return true
  if (process.env.NODE_ENV !== 'production') {
    if (new URL(request.url).searchParams.get('admin') === '1') return true
  }
  return false
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  if (isAdmin(request)) return null
  return NextResponse.json(
    { success: false, error: 'Unauthorized — admin access required' },
    { status: 401 }
  )
}

/**
 * Role-based permission check (Phase 6 extension).
 * Currently just checks admin; will be extended for granular roles.
 */
export type Permission =
  | 'admin'
  | 'content.edit'
  | 'content.publish'
  | 'guests.view'
  | 'guests.edit'
  | 'budget.view'
  | 'budget.edit'
  | 'songs.edit'
  | 'media.upload'
  | 'media.approve'
  | 'planner.view'
  | 'planner.edit'
  | 'import.execute'
  | 'export.data'

export function hasPermission(request: NextRequest, perm: Permission): boolean {
  // For now, admin has all permissions
  if (isAdmin(request)) return true
  // TODO: Phase 6 — check role-based permissions via session
  return false
}

export function requirePermission(
  request: NextRequest,
  perm: Permission
): NextResponse | null {
  if (hasPermission(request, perm)) return null
  return NextResponse.json(
    { success: false, error: `Unauthorized — requires ${perm} permission` },
    { status: 403 }
  )
}
