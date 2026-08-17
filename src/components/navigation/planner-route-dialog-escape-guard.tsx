'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

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

export function PlannerRouteDialogEscapeGuard() {
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
    return () => document.removeEventListener('keydown', closeRouteControlledDialog, true)
  }, [pathname, router])

  return null
}
