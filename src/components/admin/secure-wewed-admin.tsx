'use client'

import { AdminAccountIdentityReview } from '@/components/admin/admin-account-identity-review'
import { GovernedWewedAdminConsole } from '@/components/admin/governed-wewed-admin-console'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

interface SecureWewedAdminProps {
  onClose: () => void
}

export function SecureWewedAdmin({ onClose }: SecureWewedAdminProps) {
  return (
    <DashboardAuthGate
      title="Wewed Business Admin Console"
      description="Sign in with an active Wewed company administrator account."
      onClose={onClose}
      allowedRoles={['admin']}
      wrongRoleMessage="This page requires a Wewed company administrator account. Switch accounts to continue."
    >
      <div className="min-h-screen bg-espresso">
        <AdminAccountIdentityReview />
        <GovernedWewedAdminConsole />
      </div>
    </DashboardAuthGate>
  )
}
