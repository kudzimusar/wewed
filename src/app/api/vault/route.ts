import { NextRequest } from 'next/server'
import { requireVaultWeddingAccess } from '@/lib/vault/access'
import {
  listWeddingVaultObjects,
  uploadWeddingVaultObject,
} from '@/lib/vault/catalog'
import { vaultErrorResponse, vaultJson } from '@/lib/vault/route'

export async function GET(request: NextRequest) {
  try {
    const requestedWeddingId = request.nextUrl.searchParams.get('weddingId')
    const access = await requireVaultWeddingAccess(request, { weddingId: requestedWeddingId })
    const data = await listWeddingVaultObjects(access.weddingId)
    return vaultJson({
      success: true,
      data,
      context: {
        weddingId: access.weddingId,
        role: access.role,
        canUpload: access.canUpload,
      },
    })
  } catch (error) {
    return vaultErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const requestedWeddingId = typeof form.get('weddingId') === 'string'
      ? String(form.get('weddingId')).trim()
      : null
    const access = await requireVaultWeddingAccess(request, {
      weddingId: requestedWeddingId,
      write: true,
    })
    const file = form.get('file')
    if (!(file instanceof File)) {
      return vaultJson({ success: false, error: 'Choose a file to upload.' }, { status: 400 })
    }
    const category = typeof form.get('category') === 'string'
      ? String(form.get('category')).trim()
      : 'wedding_document'
    const data = await uploadWeddingVaultObject({
      file,
      weddingId: access.weddingId,
      actorId: access.actorUserId,
      category,
    })
    return vaultJson({ success: true, data }, { status: 201 })
  } catch (error) {
    return vaultErrorResponse(error)
  }
}
