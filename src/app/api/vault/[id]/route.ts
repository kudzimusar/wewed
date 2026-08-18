import { NextRequest } from 'next/server'
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
    await requireVaultWeddingAccess(request, { weddingId: object.weddingId })
    const signedUrl = await authorizeVaultObjectDownload(object)
    return vaultJson({
      success: true,
      data: { signedUrl, filename: object.originalFilename },
    })
  } catch (error) {
    return vaultErrorResponse(error)
  }
}
