import { NextRequest, NextResponse } from 'next/server'
import { requireWeddingPermission } from '@/lib/wedding-access'
import { deliverReminder, reminderDeliveryConfigured } from '@/lib/reminder-delivery'

export async function POST(request: NextRequest) {
  const access = await requireWeddingPermission(request, 'planner.edit')
  if (access.error) return access.error

  try {
    const body = (await request.json()) as { id?: unknown; dryRun?: unknown }
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const dryRun = body.dryRun !== false
    if (!id) {
      return NextResponse.json({ success: false, error: 'Reminder id is required.' }, { status: 400 })
    }
    if (!dryRun && !reminderDeliveryConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email delivery is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL, or use Preview.',
        },
        { status: 503 },
      )
    }

    const result = await deliverReminder({
      reminderId: id,
      weddingId: access.context.weddingId,
      actorId: access.context.session.userId,
      dryRun,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[planner reminders send POST] Error:', error)
    const message = error instanceof Error ? error.message : 'Unable to send reminder.'
    const status = message === 'Reminder not found.' ? 404 : message.includes('Cancelled') ? 409 : 500
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
