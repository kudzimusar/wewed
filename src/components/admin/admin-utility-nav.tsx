'use client'

import { usePathname } from 'next/navigation'
import { Building2, ShieldCheck, UserRoundCheck, UserRoundSearch } from 'lucide-react'

export function AdminUtilityNav() {
  const pathname = usePathname()

  if (pathname.startsWith('/admin/accept-invite')) return null

  const items = [
    ['/admin', 'Console', Building2, pathname === '/admin'],
    ['/admin/onboarding', 'Onboarding', UserRoundCheck, pathname.startsWith('/admin/onboarding')],
    ['/admin/roles', 'Roles', ShieldCheck, pathname.startsWith('/admin/roles')],
    ['/admin/planner-profiles', 'Planner profiles', UserRoundSearch, pathname.startsWith('/admin/planner-profiles')],
  ] as const

  return (
    <nav className="fixed bottom-4 left-1/2 z-50 flex max-w-[96vw] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full border border-gold/25 bg-espresso/95 p-1.5 shadow-2xl backdrop-blur" aria-label="Wewed administrator navigation">
      {items.map(([href, label, Icon, active]) => (
        <a key={href} href={href} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${active ? 'bg-gold text-espresso' : 'text-gold hover:bg-gold/10'}`}><Icon className="size-4" />{label}</a>
      ))}
    </nav>
  )
}
