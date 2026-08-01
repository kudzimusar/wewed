'use client'

import { useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { AccountBillingPortal } from '@/components/billing/account-billing-portal'
import type { DashboardRole } from '@/lib/admin-auth'

const BILLING_ROLES: readonly DashboardRole[] = ['couple', 'planner']

export function SecureAccountBilling() {
  const router = useRouter()
  return (
    <DashboardAuthGate
      title="Wewed Billing"
      description="Sign in with an active couple or planner account assigned to a business and wedding workspace."
      wrongRoleMessage="Billing belongs to a couple or planning business workspace. Your current Wewed administrator session cannot manage this customer subscription."
      allowedRoles={BILLING_ROLES}
      onClose={() => router.push('/')}
    >
      <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-espresso text-champagne">Loading billing…</main>}>
        <AccountBillingPortal />
      </Suspense>
    </DashboardAuthGate>
  )
}
