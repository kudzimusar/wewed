import 'server-only'

import { createClient } from '@supabase/supabase-js'
import {
  VaultUploadError,
  WEWED_VAULT_BUCKET,
  WEWED_VAULT_SIGNED_URL_SECONDS,
} from '@/lib/vault/core'

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) throw new VaultUploadError('Private file storage is not configured.', 500)
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function signedVaultView(input: {
  objectKey: string
  distributable?: boolean
}): Promise<string> {
  if (input.distributable === false) {
    throw new VaultUploadError('This file is quarantined and cannot be distributed yet.', 415)
  }
  const { data, error } = await supabaseAdmin().storage
    .from(WEWED_VAULT_BUCKET)
    .createSignedUrl(input.objectKey, WEWED_VAULT_SIGNED_URL_SECONDS)
  if (error || !data?.signedUrl) throw new VaultUploadError('Could not create a secure view link.', 500)
  return data.signedUrl
}
