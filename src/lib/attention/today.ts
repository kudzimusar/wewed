import type { AppSession, DashboardRole } from '@/lib/app-session'
import { listCalendarItemsForSession } from '@/lib/calendar/service'
import type { CalendarItem } from '@/lib/calendar/contracts'
import { listNotificationsForSession } from '@/lib/notifications/service'
import type { NotificationRecord } from '@/lib/notifications/contracts'

export interface TodayAttentionItem {
  id: string
  kind: 'notification' | 'calendar'
  title: string
  description: string | null
  weddingId: string | null
  weddingTitle: string | null
  category: string
  priority: 'urgent' | 'action_required' | 'important' | 'normal' | 'info'
  when: Date
  requiresAction: boolean
  deepLink: string | null
  sourceType: string
  sourceId: string | null
}

export interface TodayAttentionModel {
  role: DashboardRole
  generatedAt: Date
  needsAction: TodayAttentionItem[]
  today: TodayAttentionItem[]
  upcoming: TodayAttentionItem[]
  unreadCount: number
  summary: {
    needsAction: number
    today: number
    upcoming: number
    urgent: number
  }
}

function principalRole(session: AppSession): DashboardRole {
  return session.effectiveRole ?? session.role
}

function startOfLocalDay(value: Date) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfLocalDay(value: Date) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

function severityRank(priority: TodayAttentionItem['priority']) {
  switch (priority) {
    case 'urgent':
      return 0
    case 'action_required':
      return 1
    case 'important':
      return 2
    case 'normal':
      return 3
    default:
      return 4
  }
}

function notificationToAttention(notification: NotificationRecord): TodayAttentionItem {
  return {
    id: `notification:${notification.id}`,
    kind: 'notification',
    title: notification.title,
    description: notification.body,
    weddingId: notification.weddingId,
    weddingTitle: null,
    category: notification.category,
    priority: notification.severity,
    when: notification.snoozedUntil ?? notification.scheduledFor ?? notification.createdAt,
    requiresAction: notification.requiresAction,
    deepLink: notification.deepLink || '/notifications',
    sourceType: notification.sourceType,
    sourceId: notification.sourceId,
  }
}

function calendarPriority(item: CalendarItem): TodayAttentionItem['priority'] {
  const value = item.priority?.toLowerCase()
  if (value === 'urgent') return 'urgent'
  if (value === 'action_required' || value === 'high') return 'action_required'
  if (value === 'important') return 'important'
  if (value === 'info') return 'info'
  return 'normal'
}

function calendarToAttention(item: CalendarItem): TodayAttentionItem {
  const priority = calendarPriority(item)
  return {
    id: `calendar:${item.id}`,
    kind: 'calendar',
    title: item.title,
    description: item.description,
    weddingId: item.weddingId,
    weddingTitle: item.weddingTitle,
    category: item.category,
    priority,
    when: item.startAt,
    requiresAction: priority === 'urgent' || priority === 'action_required',
    deepLink: item.deepLink || '/calendar',
    sourceType: item.sourceType,
    sourceId: item.sourceId,
  }
}

function sortAttention(items: TodayAttentionItem[]) {
  return items.sort(
    (a, b) => severityRank(a.priority) - severityRank(b.priority) || a.when.getTime() - b.when.getTime(),
  )
}

export async function buildTodayAttentionModel(
  session: AppSession,
  now = new Date(),
): Promise<TodayAttentionModel> {
  const todayStart = startOfLocalDay(now)
  const todayEnd = endOfLocalDay(now)
  const upcomingEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000)

  const [notifications, calendar] = await Promise.all([
    listNotificationsForSession(session, { limit: 100 }),
    listCalendarItemsForSession(session, { from: todayStart, to: upcomingEnd, limit: 300 }),
  ])

  const activeNotifications = notifications.filter(
    (notification) => !['resolved', 'cancelled', 'expired', 'dismissed'].includes(notification.state),
  )
  const notificationItems = activeNotifications.map(notificationToAttention)
  const calendarItems = calendar.map(calendarToAttention)

  const notificationSourceKeys = new Set(
    notificationItems
      .filter((item) => item.sourceId)
      .map((item) => `${item.sourceType}:${item.sourceId}`),
  )
  const dedupedCalendarItems = calendarItems.filter(
    (item) => !item.sourceId || !notificationSourceKeys.has(`${item.sourceType}:${item.sourceId}`),
  )

  const all = [...notificationItems, ...dedupedCalendarItems]
  const needsAction = sortAttention(
    all.filter(
      (item) =>
        item.requiresAction || item.priority === 'urgent' || item.priority === 'action_required',
    ),
  ).slice(0, 20)
  const today = sortAttention(
    all.filter((item) => item.when >= todayStart && item.when <= todayEnd),
  ).slice(0, 30)
  const upcoming = sortAttention(
    all.filter((item) => item.when > todayEnd && item.when <= upcomingEnd),
  ).slice(0, 30)

  return {
    role: principalRole(session),
    generatedAt: now,
    needsAction,
    today,
    upcoming,
    unreadCount: activeNotifications.filter((notification) => !notification.readAt).length,
    summary: {
      needsAction: needsAction.length,
      today: today.length,
      upcoming: upcoming.length,
      urgent: all.filter((item) => item.priority === 'urgent').length,
    },
  }
}
