import { NextRequest } from 'next/server'
import { noStoreJson } from '@/lib/native-domain-context'
import { nativeGuestSummary, resolveNativeGuestWrite } from '@/lib/native-planner-guest-write'
import { deletePlannerGuest, updatePlannerGuest } from '@/lib/planner-guest-operations'

/**
 * NATIVE-MOBILE-QRO08 — native twins of the desktop guest edit/delete
 * (PATCH/DELETE /api/planner/guests/[id], guest mode). Capacity allocation writes use the same
 * canonical Guest operation as web Planner; responses carry no credential fields.
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const write = await resolveNativeGuestWrite(request)
  if (!write.ok) return write.response
  try {
    const { id } = await params
    const body = (await request.json().catch(() => null)) as {
      name?: unknown
      email?: unknown
      phone?: unknown
      attendanceAllocation?: unknown
    } | null
    const input: { name?: string; email?: string | null; phone?: string | null; attendanceAllocation?: string } = {}
    if (typeof body?.name === 'string') input.name = body.name
    if (body && 'email' in body) input.email = typeof body.email === 'string' ? body.email : null
    if (body && 'phone' in body) input.phone = typeof body.phone === 'string' ? body.phone : null
    if (typeof body?.attendanceAllocation === 'string') input.attendanceAllocation = body.attendanceAllocation
    const result = await updatePlannerGuest(write.actor, id, input)
    if (!result.ok) {
      return noStoreJson(
        { success: false, error: result.error, ...('field' in result && result.field ? { field: result.field } : {}) },
        result.status,
      )
    }
    return noStoreJson({ success: true, data: nativeGuestSummary(result.data) })
  } catch (error) {
    console.error('[native wedding guest PATCH] failed', error instanceof Error ? error.name : 'unknown')
    return noStoreJson({ success: false, error: 'Failed to update guest.' }, 500)
  }
}

/** Destructive: removes the Guest, their RSVP and their personal invitation link. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const write = await resolveNativeGuestWrite(request)
  if (!write.ok) return write.response
  try {
    const { id } = await params
    const result = await deletePlannerGuest(write.actor, id)
    if (!result.ok) {
      // Same shared contract as the desktop route: protected Guests are a deliberate 409.
      return noStoreJson(
        {
          success: false,
          error: result.error,
          ...('code' in result ? { code: result.code, protectedRecords: result.protectedRecords } : {}),
        },
        result.status,
      )
    }
    return noStoreJson({ success: true, data: result.data })
  } catch (error) {
    console.error('[native wedding guest DELETE] failed', error instanceof Error ? error.name : 'unknown')
    return noStoreJson({ success: false, error: 'Failed to delete guest.' }, 500)
  }
}
