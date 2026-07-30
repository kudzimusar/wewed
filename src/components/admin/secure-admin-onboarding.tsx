'use client'

import { useRouter } from 'next/navigation'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { AdminOnboardingManagement } from '@/components/admin/admin-onboarding-management'

export function SecureAdminOnboarding() {
  const router = useRouter()

  return (
    <DashboardAuthGate
      title="Wewed Internal Onboarding"
      description="Sign in with an active Wewed company administrator account."
      onClose={() => router.push('/')}
    >
      <AdminOnboardingManagement />
    </DashboardAuthGate>
  )
}
