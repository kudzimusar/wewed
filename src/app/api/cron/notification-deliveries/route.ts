import { NextRequest, NextResponse } from 'next/server'
import { runNotificationDeliveryRouter } from '@/lib/notifications/delivery'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const now = new Date()
    const stats = await runNotificationDeliveryRouter(now)
    return NextResponse.json({
      success: true,
      checkedAt: now.toISOString(),
      ...stats,
    })
  } catch (error) {
    console.error('[notification deliveries cron GET] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Notification delivery router failed.',
      },
      { status: 500 },
    )
  }
}
