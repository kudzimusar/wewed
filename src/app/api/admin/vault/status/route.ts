import { NextRequest, NextResponse } from 'next/server'
import { requireWewedAdmin } from '@/lib/wewed-admin'
import { assertAdminHistoricalWeddingScope } from '@/lib/admin-historical-engagement'
import { getWeddingVaultStatus } from '@/lib/vault/status'

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.support.read')
    const weddingId = request.nextUrl.searchParams.get('weddingId')?.trim() ?? ''
    if (!weddingId) return json({ success: false, error: 'weddingId is required.' }, { status: 400 })
    await assertAdminHistoricalWeddingScope(context, weddingId)
    const data = await getWeddingVaultStatus(weddingId)
    return json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Vault status failed.'
    const status = /sign in|required/i.test(message) ? 401 : /permission|scope|access|not found/i.test(message) ? 403 : 500
    return json({ success: false, error: message }, { status })
  }
}
