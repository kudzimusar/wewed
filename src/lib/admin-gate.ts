import { NextRequest, NextResponse } from 'next/server'
import { readAppSession, type AppSession } from '@/lib/app-session'

/**
 * Shared dashboard authorization gate.
 *
 * The `wewed_admin_auth` cookie is an HttpOnly, HMAC-signed application
 * session created only after Supabase Auth succeeds and the user profile has
 * an allowed role and wedding assignment.
 */
export function getAdminSession(request: NextRequest): AppSession | null {
  return readAppSession(request)
}

export function isAdmin(request: NextRequest): boolean {
  return getAdminSession(request) !== null
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  if (isAdmin(request)) return null

  return NextResponse.json(
    { success: false, error: 'Unauthorized — sign in is required' },
    { status: 401 }
  )
}

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

const PLANNER_PERMISSIONS = new Set<Permission>([
  'content.edit',
  'guests.view',
  'guests.edit',
  'budget.view',
  'budget.edit',
  'songs.edit',
  'media.upload',
  'planner.view',
  'planner.edit',
  'import.execute',
  'export.data',
])

export function hasPermission(request: NextRequest, permission: Permission): boolean {
  const session = getAdminSession(request)
  if (!session) return false

  if (session.role === 'admin' || session.role === 'couple') return true
  if (session.role === 'planner') return PLANNER_PERMISSIONS.has(permission)

  return false
}

export function requirePermission(
  request: NextRequest,
  permission: Permission
): NextResponse | null {
  if (hasPermission(request, permission)) return null

  return NextResponse.json(
    { success: false, error: `Forbidden — requires ${permission} permission` },
    { status: 403 }
  )
}
