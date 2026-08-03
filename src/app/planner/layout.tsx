import type { Metadata } from 'next'
import type { ReactNode } from 'react'

const title = 'Wewed Planner Workspace'
const description = 'Secure workspace for wedding planners, coordinators, and couples.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['Wewed', 'planner workspace', 'wedding planning'],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title,
    description,
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
}

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return children
}
