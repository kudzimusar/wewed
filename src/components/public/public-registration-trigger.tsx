'use client'

import { usePathname } from 'next/navigation'
import { UserPlus } from 'lucide-react'

export function PublicRegistrationTrigger() {
  const pathname = usePathname()
  if (
    pathname === '/register'
    || pathname.startsWith('/admin')
    || pathname.startsWith('/planner')
    || pathname.startsWith('/billing')
  ) {
    return null
  }

  return (
    <a
      href="/register"
      className="fixed right-4 top-20 z-40 inline-flex items-center gap-2 rounded-full border border-gold/35 bg-espresso/95 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-gold shadow-xl backdrop-blur transition hover:bg-gold hover:text-espresso sm:right-6"
      aria-label="Register with Wewed"
    >
      <UserPlus className="size-4" />
      Join Wewed
    </a>
  )
}
