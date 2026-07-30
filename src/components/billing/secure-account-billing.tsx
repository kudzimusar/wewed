'use client'

import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { AccountBillingPortal } from '@/components/billing/account-billing-portal'

export function SecureAccountBilling() {
  const router = useRouter()
  return (
    <DashboardAuthGate
      title="Wewed Billing"
      description="Sign in with an active Wewed account assigned to a business and wedding workspace."
      onClose={() => router.push('/')}
    >
      <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-espresso text-champagne">Loading billing…</main>}>
        <AccountBillingPortal />
      </Suspense>
    </DashboardAuthGate>
  )
}
