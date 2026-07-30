'use client'

import { usePathname } from 'next/navigation'
import { Building2, ShieldCheck } from 'lucide-react'

export function AdminUtilityNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full border border-gold/25 bg-espresso/95 p-1.5 shadow-2xl backdrop-blur" aria-label="Wewed administrator navigation">
      <a href="/admin" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${pathname === '/admin' ? 'bg-gold text-espresso' : 'text-gold hover:bg-gold/10'}`}>
        <Building2 className="size-4" />Console
      </a>
      <a href="/admin/roles" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${pathname.startsWith('/admin/roles') ? 'bg-gold text-espresso' : 'text-gold hover:bg-gold/10'}`}>
        <ShieldCheck className="size-4" />Roles
      </a>
    </nav>
  )
}
