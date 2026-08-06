'use client'

import { useRouter } from 'next/navigation'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { ClientOperationsConsole } from '@/components/admin/client-operations-console'

export function SecureClientOperations() {
  const router = useRouter()
  return (
    <DashboardAuthGate
      title="Wewed Client Systems"
      description="Sign in with an active Wewed company administrator account."
      onClose={() => router.push('/')}
    >
      <ClientOperationsConsole />
    </DashboardAuthGate>
  )
}
