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
      className="fixed bottom-4 right-4 z-[340] hidden w-[22rem] max-w-[calc(100vw-2rem)] xl:block"
      aria-label="Wewed Today widget"
      data-testid="workspace-attention-widget-dock"
    >
      <AttentionSummaryWidget />
    </aside>
  )
}
