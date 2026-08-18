'use client'

import { useRouter } from 'next/navigation'
import { AdminHistoricalEngagementConsole } from '@/components/admin/admin-historical-engagement-console'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

export function SecureServiceEngagements() {
  const router = useRouter()
  return (
    <DashboardAuthGate
      title="Wewed Service Records"
      description="Sign in with an authorized Wewed company administrator account."
      onClose={() => router.push('/')}
    >
      <AdminHistoricalEngagementConsole />
    </DashboardAuthGate>
  )
}
