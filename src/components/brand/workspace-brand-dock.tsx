'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WewedBrand } from '@/components/brand/wewed-brand'

const WORKSPACE_ROUTES = [
  ['/planner', 'Planner workspace'],
  ['/couple', 'Couple workspace'],
  ['/vendor', 'Vendor workspace'],
  ['/admin', 'Wewed administration'],
  ['/messages', 'Messages'],
  ['/vault', 'Wewed Vault'],
  ['/billing', 'Billing'],
  ['/calendar', 'Calendar'],
  ['/notifications', 'Notifications'],
  ['/contracts', 'Contracts'],
] as const

function workspaceDescriptor(pathname: string) {
  return WORKSPACE_ROUTES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1]
}

export function WorkspaceBrandDock() {
  const pathname = usePathname()
  const descriptor = workspaceDescriptor(pathname)

  if (!descriptor) return null

  return (
    <Link
      href="/"
      aria-label="Wewed home"
      className="wewed-workspace-brand-dock fixed left-[max(0.75rem,env(safe-area-inset-left))] top-[max(0.75rem,env(safe-area-inset-top))] z-[360] inline-flex max-w-[min(17rem,calc(100vw-5.75rem))] items-center rounded-full border border-gold/25 bg-espresso/92 px-2.5 py-1.5 text-champagne shadow-2xl backdrop-blur-xl transition hover:border-gold/50 hover:bg-espresso focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <WewedBrand tone="dark" size="compact" descriptor={descriptor} className="max-w-full" />
    </Link>
  )
}
