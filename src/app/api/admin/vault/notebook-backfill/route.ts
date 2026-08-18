import { NextRequest, NextResponse } from 'next/server'
import { requireWewedAdmin } from '@/lib/wewed-admin'
import { assertAdminHistoricalWeddingScope } from '@/lib/admin-historical-engagement'
import {
  backfillWeddingNotebookAttachments,
  countLegacyWeddingNotebookAttachments,
} from '@/lib/notebook/vault-backfill'

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'private, no-store, max-age=0')
  response.headers.set('Vary', 'Cookie')
  return response
}

function weddingIdFrom(request: NextRequest, body?: Record<string, unknown>): string {
  const value = body?.weddingId ?? request.nextUrl.searchParams.get('weddingId')
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.support.read')
    const weddingId = weddingIdFrom(request)
    if (!weddingId) return json({ success: false, error: 'weddingId is required.' }, { status: 400 })
    await assertAdminHistoricalWeddingScope(context, weddingId)
    const eligible = await countLegacyWeddingNotebookAttachments(weddingId)
    return json({ success: true, data: { weddingId, eligible } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notebook Vault backfill status failed.'
    const status = /sign in|required/i.test(message) ? 401 : /permission|scope|access|not found/i.test(message) ? 403 : 500
    return json({ success: false, error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireWewedAdmin(request, 'admin.support.manage')
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const weddingId = weddingIdFrom(request, body)
    if (!weddingId) return json({ success: false, error: 'weddingId is required.' }, { status: 400 })
    await assertAdminHistoricalWeddingScope(context, weddingId)
    const limit = typeof body.limit === 'number' && Number.isFinite(body.limit) ? Math.trunc(body.limit) : undefined
    const data = await backfillWeddingNotebookAttachments({
      weddingId,
      actorUserId: context.session.userId,
      limit,
    })
    return json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Notebook Vault backfill failed.'
    const status = /sign in|required/i.test(message) ? 401 : /permission|scope|access|not found/i.test(message) ? 403 : 500
    return json({ success: false, error: message }, { status })
  }
}
