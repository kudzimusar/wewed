'use client'

import { useRouter } from 'next/navigation'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { AdminRoleManagement } from '@/components/admin/admin-role-management'

export function SecureAdminRoles() {
  const router = useRouter()
  return (
    <DashboardAuthGate
      title="Wewed Administrator Roles"
      description="Sign in with an active Wewed company administrator account."
      onClose={() => router.push('/')}
    >
      <AdminRoleManagement />
    </DashboardAuthGate>
  )
}
