import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { loadPlannerGuest360 } from '@/lib/planner-guest-360'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireWeddingPermission(request, 'guests.view')
  if (access.error) return access.error

  const { id } = await params
  const data = await loadPlannerGuest360(
    access.context.weddingId,
    id,
    request.nextUrl.origin,
  )
  if (!data) {
    return NextResponse.json(
      { success: false, error: 'Guest not found in the active wedding.' },
      { status: 404, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    )
  }

  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie' } },
  )
}
