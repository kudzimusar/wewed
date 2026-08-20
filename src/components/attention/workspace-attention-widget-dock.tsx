'use client'

import { usePathname } from 'next/navigation'
import { AttentionSummaryWidget } from '@/components/attention/attention-summary-widget'

const PRIVATE_PREFIXES = [
  '/admin',
  '/couple',
  '/planner',
  '/vendor',
  '/vendors/manage',
  '/messages',
  '/billing',
] as const

export function WorkspaceAttentionWidgetDock() {
  const pathname = usePathname()
  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  const isAttentionSurface =
    pathname === '/today' || pathname.startsWith('/today/') ||
    pathname === '/calendar' || pathname.startsWith('/calendar/') ||
    pathname === '/notifications' || pathname.startsWith('/notifications/')

  if (!isPrivate || isAttentionSurface) return null

  return (
    <aside
      className="relative z-10 mx-auto hidden w-full max-w-[96rem] justify-end px-4 pb-4 xl:flex"
      aria-label="Wewed Today widget"
      data-testid="workspace-attention-widget-dock"
    >
      <AttentionSummaryWidget className="w-[22rem] max-w-full" />
    </aside>
  )
}
