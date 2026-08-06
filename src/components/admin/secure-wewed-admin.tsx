'use client'

import { AdminAccountIdentityReview } from '@/components/admin/admin-account-identity-review'
import { GovernedWewedAdminConsole } from '@/components/admin/governed-wewed-admin'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

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
      <div className="min-h-screen bg-espresso">
        <AdminAccountIdentityReview />
        <GovernedWewedAdminConsole />
      </div>
    </DashboardAuthGate>
  )
}
