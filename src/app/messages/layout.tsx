import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import './messages.css'

export const metadata: Metadata = {
  title: 'Messages | Wewed',
  description: 'Private Wewed communications and collaboration inbox.',
  robots: { index: false, follow: false },
}

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <Link
        href="/messages/settings"
        className="fixed bottom-4 right-4 z-[190] hidden items-center gap-2 rounded-full border border-gold/25 bg-espresso px-4 py-2 text-xs font-semibold text-champagne shadow-xl hover:text-gold lg:inline-flex"
        aria-label="Message delivery channel settings"
      >
        <Settings2 className="size-4" />
        Channels
      </Link>
    </>
  )
}