'use client'

import Link from 'next/link'
import { FileSearch2 } from 'lucide-react'
import { AdminAccountIdentityReview } from '@/components/admin/admin-account-identity-review'
import { AdminCommandCentre } from '@/components/admin/admin-command-centre'
import { AdminProductivityConsole } from '@/components/admin/admin-productivity-console'
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
      <div className="wewed-admin-responsive min-h-screen bg-espresso">
        <AdminAccountIdentityReview />
        <div className="mx-auto flex max-w-7xl justify-end px-4 pb-2 sm:px-6">
          <Link href="/admin/bookings" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-champagne/20 bg-champagne/5 px-4 text-xs font-bold text-champagne transition hover:bg-champagne/10">
            <FileSearch2 className="size-4" />
            Booking support
          </Link>
        </div>
        <AdminProductivityConsole>
          <AdminCommandCentre />
          <div className="admin-governance-responsive">
            <GovernedWewedAdminConsole />
          </div>
        </AdminProductivityConsole>
      </div>
    </DashboardAuthGate>
  )
}
