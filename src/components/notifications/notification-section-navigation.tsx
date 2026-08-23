'use client'

import Link from 'next/link'
import { ArrowLeft, Bell, LayoutDashboard, Settings, SlidersHorizontal } from 'lucide-react'
import {
  type AccountRole,
  usePublicAccountSession,
} from '@/components/public/public-account-actions'

type NotificationSurface = 'center' | 'settings' | 'push'

function workspaceHrefFor(role: AccountRole | undefined) {
  if (role === 'admin') return '/admin'
  if (role === 'planner') return '/planner/portfolio'
  if (role === 'vendor') return '/vendor'
  if (role === 'provider') return '/vendors/manage'
  if (role === 'couple') return '/couple'
  return '/settings'
}

const controlClass =
  'inline-flex size-10 items-center justify-center rounded-full border border-gold/20 bg-white/90 text-espresso/65 shadow-sm transition hover:border-gold/45 hover:bg-champagne/55 hover:text-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/55'

export function NotificationSectionNavigation({ surface }: { surface: NotificationSurface }) {
  const session = usePublicAccountSession()
  const workspaceHref = workspaceHrefFor(session?.authorized ? session.user?.role : undefined)

  if (surface === 'center') {
    return (
      <nav
        className="mb-3 flex items-center justify-between sm:mt-8"
        aria-label="Notification section navigation"
        data-testid="notification-section-navigation"
      >
        <div className="flex items-center gap-1.5">
          <Link
            href={workspaceHref}
            className={controlClass}
            data-testid="notification-exit-workspace"
            aria-label="Back to workspace"
            title="Workspace"
          >
            <LayoutDashboard className="size-4" />
          </Link>
          <Link
            href="/settings"
            className={controlClass}
            data-testid="notification-exit-settings"
            aria-label="Back to settings"
            title="Settings"
          >
            <Settings className="size-4" />
          </Link>
        </div>
        <Link
          href="/settings/notifications"
          className={controlClass}
          data-testid="notification-open-settings"
          aria-label="Notification settings"
          title="Notification settings"
        >
          <SlidersHorizontal className="size-4" />
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
        <div className="flex items-center gap-1.5">
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
            href={workspaceHref}
            className={controlClass}
            data-testid="notification-exit-workspace"
            aria-label="Back to workspace"
            title="Workspace"
          >
            <LayoutDashboard className="size-4" />
          </Link>
        </div>
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
      className="mb-3 flex items-center justify-between"
      aria-label="Notification section navigation"
      data-testid="notification-section-navigation"
    >
      <div className="flex items-center gap-1.5">
        <Link
          href="/settings/notifications"
          className={controlClass}
          data-testid="notification-back-to-settings"
          aria-label="Back to notification settings"
          title="Back to notification settings"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Link
          href="/settings"
          className={controlClass}
          data-testid="notification-exit-settings"
          aria-label="Back to settings"
          title="Settings"
        >
          <Settings className="size-4" />
        </Link>
      </div>
      <Link
        href={workspaceHref}
        className={controlClass}
        data-testid="notification-exit-workspace"
        aria-label="Back to workspace"
        title="Workspace"
      >
        <LayoutDashboard className="size-4" />
      </Link>
    </nav>
  )
}
