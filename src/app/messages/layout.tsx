import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import MessagesNewMessageLauncher from '@/components/communications/messages-new-message-launcher'

export const metadata: Metadata = {
  title: 'Messages | Wewed',
  description: 'Private Wewed communications and collaboration inbox.',
  robots: { index: false, follow: false },
}

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <MessagesNewMessageLauncher />
      {children}
    </>
  )
}
