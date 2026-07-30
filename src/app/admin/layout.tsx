import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Wewed Business Admin Console',
  description: 'Private parent-company operations workspace for Wewed.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children
}
