'use client'

import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { GovernedWewedAdminConsole } from '@/components/admin/governed-wewed-admin'

interface SecureWewedAdminProps {
  onClose: () => void
}

export function SecureWewedAdmin({ onClose }: SecureWewedAdminProps) {
  return (
    <DashboardAuthGate
      title="Wewed Governance & Business Admin"
      description="Sign in with your individual, active Wewed platform administrator identity."
      onClose={onClose}
    >
      <GovernedWewedAdminConsole />
    </DashboardAuthGate>
  )
}
