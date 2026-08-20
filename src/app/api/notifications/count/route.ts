import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import { NotificationAccessError, unreadNotificationCountForSession } from '@/lib/notifications/service'

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const unreadCount = await unreadNotificationCountForSession(session)
    return NextResponse.json({ success: true, unreadCount })
  } catch (error) {
    console.error('[notifications count GET] Error:', error)
    if (error instanceof NotificationAccessError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 })
    }
    return NextResponse.json(
      { success: false, error: 'Unable to load notification count.' },
      { status: 500 },
    )
  }
}
