'use client'

import Link from 'next/link'
import { ArrowLeft, Bell, LayoutDashboard, Settings, SlidersHorizontal } from 'lucide-react'
import {
  type AccountRole,
  usePublicAccountSession,
} from '@/components/public/public-account-actions'

type NotificationSurface = 'center' | 'settings' | 'push'

function workspaceFor(role: AccountRole) {
  if (role === 'admin') return { href: '/admin', label: 'Administration' }
  if (role === 'planner') return { href: '/planner', label: 'Planner workspace' }
  if (role === 'vendor') return { href: '/vendor', label: 'Vendor workspace' }
  if (role === 'provider') return { href: '/vendors/manage', label: 'Provider profile' }
  return { href: '/couple', label: 'Couple workspace' }
}

export function NotificationSectionNavigation({ surface }: { surface: NotificationSurface }) {
  const session = usePublicAccountSession()
  const workspace = session?.authorized && session.user?.role
    ? workspaceFor(session.user.role)
    : { href: '/settings', label: 'Workspace' }
  const dark = surface === 'center'
  const linkClass = dark
    ? 'inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#bf9b5f]/25 px-3 text-sm font-semibold text-[#f5ead7]/75 transition hover:bg-[#bf9b5f]/10 hover:text-[#bf9b5f]'
    : 'inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#2a211b]/15 bg-white px-3 text-sm font-semibold text-[#725329] transition hover:border-[#8a672f]/35 hover:bg-[#f4ecde]'

  return (
    <nav
      className="mb-5 flex flex-wrap items-center gap-2"
      aria-label="Notification section navigation"
      data-testid="notification-section-navigation"
    >
      {surface === 'center' ? (
        <>
          <Link href={workspace.href} className={linkClass} data-testid="notification-exit-workspace">
            <ArrowLeft className="size-4" /> {workspace.label}
          </Link>
          <Link href="/settings" className={linkClass} data-testid="notification-exit-settings">
            <Settings className="size-4" /> Settings
          </Link>
          <Link href="/settings/notifications" className={linkClass} data-testid="notification-open-settings">
            <SlidersHorizontal className="size-4" /> Notification settings
          </Link>
        </>
      ) : surface === 'settings' ? (
        <>
          <Link href="/settings" className={linkClass} data-testid="notification-exit-settings">
            <ArrowLeft className="size-4" /> Settings
          </Link>
          <Link href="/notifications" className={linkClass} data-testid="notification-open-center">
            <Bell className="size-4" /> Notifications
          </Link>
          <Link href={workspace.href} className={linkClass} data-testid="notification-exit-workspace">
            <LayoutDashboard className="size-4" /> {workspace.label}
          </Link>
        </>
      ) : (
        <>
          <Link href="/settings/notifications" className={linkClass} data-testid="notification-back-to-settings">
            <ArrowLeft className="size-4" /> Notification settings
          </Link>
          <Link href="/settings" className={linkClass} data-testid="notification-exit-settings">
            <Settings className="size-4" /> Settings
          </Link>
          <Link href={workspace.href} className={linkClass} data-testid="notification-exit-workspace">
            <LayoutDashboard className="size-4" /> {workspace.label}
          </Link>
        </>
      )}
    </nav>
  )
}
