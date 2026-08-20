import type { Metadata } from 'next'
import { Suspense, type ReactNode } from 'react'
import { PlannerRouteDialogEscapeGuard } from '@/components/navigation/planner-route-dialog-escape-guard'
import { NotebookUtilityEntry } from '@/components/notebook/notebook-utility-entry'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { PlannerWorksheetCommandCenter } from '@/components/wedding/planner/planner-worksheet-command-center'
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
      <div className="fixed right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-[365] rounded-full border border-gold/25 bg-espresso/95 p-1 text-champagne shadow-xl backdrop-blur">
        <NotificationBell className="text-champagne/75 hover:text-gold" />
      </div>
      <Suspense fallback={null}>
        <PlannerWorksheetCommandCenter />
      </Suspense>
      <NotebookUtilityEntry surface="planner" />
      <PlannerRouteDialogEscapeGuard />
    </>
  )
}
