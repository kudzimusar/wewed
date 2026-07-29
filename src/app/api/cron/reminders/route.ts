import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  deliverReminder,
  markReminderDeliveryFailure,
  reminderDeliveryConfigured,
} from '@/lib/reminder-delivery'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }
  if (!reminderDeliveryConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Reminder delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.',
      },
      { status: 503 },
    )
  }

  const now = new Date()
  const due = await db.contentRevision.findMany({
    where: {
      section: 'planner_reminder',
      status: 'scheduled',
      scheduledFor: { lte: now },
    },
    select: { id: true, weddingId: true },
    orderBy: { scheduledFor: 'asc' },
    take: 25,
  })

  const processed: Array<{
    id: string
    weddingId: string
    status: 'sent' | 'failed' | 'skipped'
    sent?: number
    error?: string
  }> = []

  for (const reminder of due) {
    const claim = await db.contentRevision.updateMany({
      where: {
        id: reminder.id,
        status: 'scheduled',
        scheduledFor: { lte: now },
      },
      data: { status: 'sending' },
    })
    if (claim.count !== 1) {
      processed.push({ ...reminder, status: 'skipped' })
      continue
    }

    try {
      const result = await deliverReminder({
        reminderId: reminder.id,
        weddingId: reminder.weddingId,
        dryRun: false,
      })
      if (result.dryRun) throw new Error('Scheduled delivery unexpectedly returned a preview.')
      processed.push({ ...reminder, status: 'sent', sent: result.sent })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scheduled reminder failed.'
      await markReminderDeliveryFailure(reminder.id, message)
      processed.push({ ...reminder, status: 'failed', error: message })
    }
  }

  return NextResponse.json({
    success: true,
    checkedAt: now.toISOString(),
    due: due.length,
    processed,
  })
}
