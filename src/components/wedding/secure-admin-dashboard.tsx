'use client'

import { AdminDashboard } from '@/components/wedding/admin-dashboard'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

interface SecureAdminDashboardProps {
  onClose: () => void
}

export function SecureAdminDashboard({ onClose }: SecureAdminDashboardProps) {
  return (
    <DashboardAuthGate
      title="Couple Dashboard"
      description="Sign in to manage RSVPs, messages, songs, and wedding-day controls."
      onClose={onClose}
    >
      <AdminDashboard onClose={onClose} />
    </DashboardAuthGate>
  )
}
