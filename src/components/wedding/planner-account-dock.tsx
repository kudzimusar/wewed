'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { BriefcaseBusiness, ClipboardList, LayoutDashboard, MessageCircle, Sparkles } from 'lucide-react'

const items = [
  ['/planner', 'Workspace', LayoutDashboard],
  ['/planner/wedding-brief', 'Brief', ClipboardList],
  ['/messages', 'Messages', MessageCircle],
  ['/planner/ai-workspace', 'AI', Sparkles],
  ['/planner/marketplace', 'Business', BriefcaseBusiness],
] as const

function itemIsActive(pathname: string, href: string): boolean {
  if (href === '/planner') {
    return (
      pathname === '/planner' ||
      (pathname.startsWith('/planner/') &&
        !pathname.startsWith('/planner/marketplace') &&
        !pathname.startsWith('/planner/ai-workspace') &&
        !pathname.startsWith('/planner/wedding-brief'))
    )
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

function plannerModuleRoute(pathname: string): string | null {
  const match = pathname.match(
    /^\/planner\/(overview|tasks|budget|vendors|guests|timeline|seating)\/(?:import|imports)$/,
  )
  return match ? `/planner/${match[1]}` : null
}

function nestedOverlayIsOpen(): boolean {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-slot="select-content"], [role="listbox"], [data-radix-popper-content-wrapper]',
    ),
  ).some((element) => {
    const styles = window.getComputedStyle(element)
    const box = element.getBoundingClientRect()
    return (
      styles.display !== 'none' &&
      styles.visibility !== 'hidden' &&
      box.width > 0 &&
      box.height > 0
    )
  })
}

export function PlannerAccountDock() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const parentRoute = plannerModuleRoute(pathname)
    if (!parentRoute) return

    const closeRouteControlledDialog = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (!document.querySelector('[data-testid="import-dialog"]')) return
      if (nestedOverlayIsOpen()) return

      event.preventDefault()
      event.stopPropagation()
      const suffix = `${window.location.search}${window.location.hash}`
      router.replace(`${parentRoute}${suffix}`)
    }

    document.addEventListener('keydown', closeRouteControlledDialog, true)
    return () => {
      document.removeEventListener('keydown', closeRouteControlledDialog, true)
    }
  }, [pathname, router])

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
