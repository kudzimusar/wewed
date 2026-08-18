'use client'

import { useRouter } from 'next/navigation'
import { AdminTransactionGovernanceConsole } from '@/components/admin/admin-transaction-governance-console'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

export function SecureTransactionGovernance() {
  const router = useRouter()
  return (
    <DashboardAuthGate
      title="Wewed Transaction Governance"
      description="Sign in with an authorized Wewed company administrator account."
      onClose={() => router.push('/')}
    >
      <AdminTransactionGovernanceConsole />
    </DashboardAuthGate>
  )
}
