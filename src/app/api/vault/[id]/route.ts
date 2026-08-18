import { NextRequest } from 'next/server'
import { logAuditEvent } from '@/lib/audit'
import { requireVaultWeddingAccess } from '@/lib/vault/access'
import {
  authorizeVaultObjectDownload,
  findVaultObjectForDownload,
} from '@/lib/vault/catalog'
import { vaultErrorResponse, vaultJson } from '@/lib/vault/route'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const object = await findVaultObjectForDownload(id)
    if (!object || object.deletedAt) {
      return vaultJson({ success: false, error: 'Vault file not found.' }, { status: 404 })
    }
    const access = await requireVaultWeddingAccess(request, { weddingId: object.weddingId })
    const signedUrl = await authorizeVaultObjectDownload(object)
    await logAuditEvent({
      action: 'vault.object.access_authorized',
      resourceType: 'VaultObject',
      resourceId: object.id,
      weddingId: object.weddingId,
      actorId: access.actorUserId,
    })
    return vaultJson({
      success: true,
      data: { signedUrl, filename: object.originalFilename },
    })
  } catch (error) {
    return vaultErrorResponse(error)
  }
}
