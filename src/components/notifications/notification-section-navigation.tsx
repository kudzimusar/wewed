'use client'

import Link from 'next/link'
import { ArrowLeft, Bell, Settings } from 'lucide-react'

type NotificationSurface = 'center' | 'settings' | 'push'

const controlClass =
  'inline-flex size-10 items-center justify-center rounded-full border border-gold/20 bg-white/90 text-espresso/65 shadow-sm transition hover:border-gold/45 hover:bg-champagne/55 hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/55'

export function NotificationSectionNavigation({ surface }: { surface: NotificationSurface }) {
  if (surface === 'center') {
    return (
      <nav
        className="mb-3 flex justify-end"
        aria-label="Notification section navigation"
        data-testid="notification-section-navigation"
      >
        <Link
          href="/settings/notifications"
          className={controlClass}
          data-testid="notification-open-settings"
          aria-label="Notification settings"
          title="Notification settings"
        >
          <Settings className="size-4" />
        </Link>
      </nav>
    )
  }

  if (surface === 'settings') {
    return (
      <nav
        className="mb-3 flex items-center justify-between"
        aria-label="Notification section navigation"
        data-testid="notification-section-navigation"
      >
        <Link
          href="/settings"
          className={controlClass}
          data-testid="notification-exit-settings"
          aria-label="Back to settings"
          title="Back to settings"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Link
          href="/notifications"
          className={controlClass}
          data-testid="notification-open-center"
          aria-label="Notifications"
          title="Notifications"
        >
          <Bell className="size-4" />
        </Link>
      </nav>
    )
  }

  return (
    <nav
      className="mb-3 flex items-center"
      aria-label="Notification section navigation"
      data-testid="notification-section-navigation"
    >
      <Link
        href="/settings/notifications"
        className={controlClass}
        data-testid="notification-back-to-settings"
        aria-label="Back to notification settings"
        title="Back to notification settings"
      >
        <ArrowLeft className="size-4" />
      </Link>
    </nav>
  )
}
