import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { PlannerRouteDialogEscapeGuard } from '@/components/navigation/planner-route-dialog-escape-guard'
import './planner-responsive.css'
import './adaptive-navigation.css'

const title = 'Wewed Planner Workspace'
const description = 'Secure workspace for wedding planners, coordinators, and couples.'

export const metadata: Metadata = {
  title,
  description,
  keywords: ['Wewed', 'planner workspace', 'wedding planning'],
  robots: { index: false, follow: false },
  openGraph: { title, description, type: 'website' },
  twitter: { card: 'summary', title, description },
}

export default function PlannerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="dark min-h-dvh bg-espresso text-champagne" data-planner-theme-scope="dark">
        {children}
      </div>
      <PlannerRouteDialogEscapeGuard />
    </>
  )
}
