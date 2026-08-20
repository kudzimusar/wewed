'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface NotificationBellProps {
  className?: string
  showLabel?: boolean
}

interface BadgeNavigator extends Navigator {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

async function syncAppBadge(unreadCount: number) {
  if (typeof navigator === 'undefined') return
  const badgeNavigator = navigator as BadgeNavigator
  try {
    if (unreadCount > 0 && badgeNavigator.setAppBadge) {
      await badgeNavigator.setAppBadge(unreadCount)
    } else if (badgeNavigator.clearAppBadge) {
      await badgeNavigator.clearAppBadge()
    }
  } catch {
    // App badging is optional progressive enhancement.
  }
}

export function NotificationBell({ className = '', showLabel = false }: NotificationBellProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/count', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (response.status === 401 || response.status === 403) {
        setAuthorized(false)
        setUnreadCount(0)
        await syncAppBadge(0)
        return
      }
      if (!response.ok) return
      const payload = (await response.json()) as { success?: boolean; unreadCount?: number }
      if (payload.success) {
        const count = Math.max(0, Number(payload.unreadCount ?? 0))
        setAuthorized(true)
        setUnreadCount(count)
        await syncAppBadge(count)
      }
    } catch {
      // The bell is progressive enhancement; navigation must remain usable if count lookup fails.
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  if (authorized === false) return null

  const badge = unreadCount > 99 ? '99+' : String(unreadCount)
  return (
    <Link
      href="/notifications"
      aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      title="Notifications"
      className={`relative inline-flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-full text-current transition hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 ${className}`}
      data-testid="notification-bell"
    >
      <Bell className="size-4" aria-hidden="true" />
      {showLabel && <span className="text-sm">Notifications</span>}
      {unreadCount > 0 && (
        <span
          className="absolute -right-1 -top-1 min-w-5 rounded-full bg-gold px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-espresso"
          data-testid="notification-unread-count"
        >
          {badge}
        </span>
      )}
    </Link>
  )
}
