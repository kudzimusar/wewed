import 'server-only'

import type { NextRequest } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { getWeddingContext, contextHasPermission } from '@/lib/wedding-access'
import { requireWewedAdmin, type WewedAdminContext } from '@/lib/wewed-admin'
import { assertAdminHistoricalWeddingScope } from '@/lib/admin-historical-engagement'

export class VaultAccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 404 = 403,
  ) {
    super(message)
    this.name = 'VaultAccessError'
  }
}

export type VaultWeddingAccess = {
  actorUserId: string
  weddingId: string
  role: 'admin' | 'couple' | 'planner' | 'coordinator' | 'owner' | 'viewer'
  canUpload: boolean
  adminContext?: WewedAdminContext
}

export async function requireVaultWeddingAccess(
  request: NextRequest,
  options?: { weddingId?: string | null; write?: boolean },
): Promise<VaultWeddingAccess> {
  const session = readAppSession(request)
  if (!session) throw new VaultAccessError('Authentication required.', 401)

  if (session.role === 'admin') {
    const weddingId = options?.weddingId?.trim()
    if (!weddingId) throw new VaultAccessError('Choose a wedding before opening Wewed Vault.', 403)
    const adminContext = await requireWewedAdmin(
      request,
      options?.write ? 'admin.support.manage' : 'admin.support.read',
    )
    await assertAdminHistoricalWeddingScope(adminContext, weddingId)
    return {
      actorUserId: session.userId,
      weddingId,
      role: 'admin',
      canUpload: options?.write ? true : adminContext.permissions.includes('*') || adminContext.permissions.includes('admin.support.manage'),
      adminContext,
    }
  }

  const context = await getWeddingContext(request)
  if (!context) throw new VaultAccessError('Active wedding access is required.', 401)
  if (options?.weddingId && options.weddingId !== context.weddingId) {
    throw new VaultAccessError('Vault object was not found in the active wedding.', 404)
  }

  const canUpload = contextHasPermission(context, 'media.upload') || contextHasPermission(context, 'planner.edit')
  if (options?.write && !canUpload) {
    throw new VaultAccessError('You do not have permission to upload wedding files.', 403)
  }
  if (session.role === 'vendor') {
    throw new VaultAccessError('Vendor Vault access is limited to authorized conversations and service engagements.', 403)
  }

  return {
    actorUserId: session.userId,
    weddingId: context.weddingId,
    role: context.role,
    canUpload,
  }
}
