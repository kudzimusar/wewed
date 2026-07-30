'use client'

import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { WewedAdminConsole } from '@/components/admin/wewed-admin-console'

interface SecureWewedAdminProps {
  onClose: () => void
}

export function SecureWewedAdmin({ onClose }: SecureWewedAdminProps) {
  return (
    <DashboardAuthGate
      title="Wewed Business Admin Console"
      description="Sign in with an active Wewed company administrator account."
      onClose={onClose}
    >
      <WewedAdminConsole />
    </DashboardAuthGate>
  )
}
