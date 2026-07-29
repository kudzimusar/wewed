import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Wewed Planner Workspace',
  description: 'Secure workspace for wedding planners, coordinators, and couples.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return children
}
