'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BriefcaseBusiness, House, LayoutDashboard } from 'lucide-react'

const items = [
  ['/planner', 'Workspace', LayoutDashboard],
  ['/planner/marketplace', 'Business', BriefcaseBusiness],
  ['/', 'Wewed', House],
] as const

function itemIsActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/'
  if (href === '/planner') {
    return (
      pathname === '/planner' ||
      (pathname.startsWith('/planner/') &&
        !pathname.startsWith('/planner/marketplace'))
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PlannerAccountDock() {
  const pathname = usePathname()
  return (
    <nav
      className="fixed bottom-3 left-1/2 z-[180] flex -translate-x-1/2 items-center gap-1 rounded-full border border-gold/25 bg-espresso/95 p-1.5 text-champagne shadow-2xl backdrop-blur"
      aria-label="Planner account navigation"
    >
      {items.map(([href, label, Icon]) => {
        const active = itemIsActive(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold ${active ? 'bg-gold text-espresso' : 'text-champagne/70 hover:bg-gold/10 hover:text-gold'}`}
          >
            <Icon className="size-3.5" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
