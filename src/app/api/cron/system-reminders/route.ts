import { NextRequest, NextResponse } from 'next/server'
import { runSystemNotificationScheduler } from '@/lib/notifications/scheduler'
import { resolveTerminalSourceNotifications } from '@/lib/notifications/terminal-source-resolution'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const now = new Date()
    const terminalSourceResolved = await resolveTerminalSourceNotifications()
    const stats = await runSystemNotificationScheduler(now)
    stats.sourceNotificationsResolved += terminalSourceResolved
    return NextResponse.json({
      success: true,
      checkedAt: now.toISOString(),
      ...stats,
    })
  } catch (error) {
    console.error('[system reminders cron GET] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'System reminder scheduler failed.',
      },
      { status: 500 },
    )
  }
}
