import 'server-only'

import { NextResponse } from 'next/server'
import { VaultAccessError } from '@/lib/vault/access'
import { VaultUploadError } from '@/lib/vault/core'

export function vaultJson(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export function vaultErrorResponse(error: unknown) {
  if (error instanceof VaultAccessError || error instanceof VaultUploadError) {
    return vaultJson({ success: false, error: error.message }, { status: error.status })
  }
  if (error instanceof Error && (
    error.message.includes('Unsupported Vault upload category')
    || error.message.includes('quarantined')
  )) {
    return vaultJson(
      { success: false, error: error.message },
      { status: error.message.includes('quarantined') ? 423 : 400 },
    )
  }
  console.error('[VAULT] Unexpected error:', error)
  return vaultJson({ success: false, error: 'Vault request failed.' }, { status: 500 })
}
