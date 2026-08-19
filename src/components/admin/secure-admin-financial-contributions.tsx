'use client'

import { useRouter } from 'next/navigation'
import { AdminFinancialContributions } from '@/components/admin/admin-financial-contributions'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'

export function SecureAdminFinancialContributions() {
  const router = useRouter()
  return <DashboardAuthGate title="Wewed Financial Contributions" description="Sign in with an authorized Wewed company administrator account." onClose={() => router.push('/')}><AdminFinancialContributions /></DashboardAuthGate>
}
