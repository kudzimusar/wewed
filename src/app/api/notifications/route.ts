import { NextRequest, NextResponse } from 'next/server'
import { readAppSession } from '@/lib/app-session'
import {
  acknowledgeNotification,
  listNotificationsForSession,
  NotificationAccessError,
  NotificationNotFoundError,
  resolveNotification,
  setNotificationReadState,
  snoozeNotification,
  unreadNotificationCountForSession,
} from '@/lib/notifications/service'
import {
  notificationCategorySchema,
  notificationStateSchema,
} from '@/lib/notifications/contracts'

function serializeNotification(notification: Awaited<ReturnType<typeof listNotificationsForSession>>[number]) {
  return {
    ...notification,
    readAt: notification.readAt?.toISOString() ?? null,
    acknowledgedAt: notification.acknowledgedAt?.toISOString() ?? null,
    resolvedAt: notification.resolvedAt?.toISOString() ?? null,
    scheduledFor: notification.scheduledFor?.toISOString() ?? null,
    snoozedUntil: notification.snoozedUntil?.toISOString() ?? null,
    expiresAt: notification.expiresAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
    updatedAt: notification.updatedAt.toISOString(),
  }
}

function errorResponse(error: unknown) {
  if (error instanceof NotificationAccessError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 403 })
  }
  if (error instanceof NotificationNotFoundError) {
    return NextResponse.json({ success: false, error: error.message }, { status: 404 })
  }
  const message = error instanceof Error ? error.message : 'Unable to process notification request.'
  return NextResponse.json({ success: false, error: message }, { status: 400 })
}

export async function GET(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const params = request.nextUrl.searchParams
    const stateRaw = params.get('state') ?? undefined
    const categoryRaw = params.get('category') ?? undefined
    const state = stateRaw ? notificationStateSchema.parse(stateRaw) : undefined
    const category = categoryRaw ? notificationCategorySchema.parse(categoryRaw) : undefined
    const weddingId = params.get('weddingId')?.trim() || undefined
    const unreadOnly = params.get('unreadOnly') === 'true'
    const rawLimit = Number(params.get('limit') ?? 50)
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(100, Math.trunc(rawLimit))) : 50

    const [notifications, unreadCount] = await Promise.all([
      listNotificationsForSession(session, { state, category, weddingId, unreadOnly, limit }),
      unreadNotificationCountForSession(session),
    ])

    return NextResponse.json({
      success: true,
      unreadCount,
      data: notifications.map(serializeNotification),
    })
  } catch (error) {
    console.error('[notifications GET] Error:', error)
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  const session = readAppSession(request)
  if (!session) {
    return NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const action = typeof body.action === 'string' ? body.action.trim() : ''

    if (!id) {
      return NextResponse.json({ success: false, error: 'Notification id is required.' }, { status: 400 })
    }

    if (action === 'read') {
      const notification = await setNotificationReadState(session, id, true)
      return NextResponse.json({ success: true, data: serializeNotification(notification) })
    }
    if (action === 'unread') {
      let notification = await setNotificationReadState(session, id, false)
      // Only an ordinary read notification can be intentionally made unread again. Acknowledged,
      // scheduled and terminal lifecycle states stay read so another device can never make a handled
      // notification appear new by issuing a stale/unexpected unread action.
      if (!['active', 'read'].includes(notification.state)) {
        notification = await setNotificationReadState(session, id, true)
      }
      return NextResponse.json({ success: true, data: serializeNotification(notification) })
    }
    if (action === 'acknowledge') {
      const notification = await acknowledgeNotification(session, id)
      return NextResponse.json({ success: true, data: serializeNotification(notification) })
    }
    if (action === 'resolve') {
      const notification = await resolveNotification(session, id)
      return NextResponse.json({ success: true, data: serializeNotification(notification) })
    }
    if (action === 'snooze') {
      const triggerAt = typeof body.triggerAt === 'string' ? body.triggerAt : ''
      const timezone = typeof body.timezone === 'string' && body.timezone.trim()
        ? body.timezone.trim()
        : 'UTC'
      const result = await snoozeNotification(session, {
        notificationId: id,
        triggerAt,
        timezone,
      })
      return NextResponse.json({
        success: true,
        data: {
          notification: serializeNotification(result.notification),
          reminder: {
            ...result.reminder,
            triggerAt: result.reminder.triggerAt.toISOString(),
            triggeredAt: result.reminder.triggeredAt?.toISOString() ?? null,
            cancelledAt: result.reminder.cancelledAt?.toISOString() ?? null,
            createdAt: result.reminder.createdAt.toISOString(),
            updatedAt: result.reminder.updatedAt.toISOString(),
          },
        },
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported notification action.' },
      { status: 400 },
    )
  } catch (error) {
    console.error('[notifications PATCH] Error:', error)
    return errorResponse(error)
  }
}
