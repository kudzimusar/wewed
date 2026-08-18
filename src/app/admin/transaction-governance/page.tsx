import type { Metadata } from 'next'
import { SecureTransactionGovernance } from '@/components/admin/secure-transaction-governance'

export const metadata: Metadata = {
  title: 'Payments, Evidence & Disputes | Wewed Admin',
  description: 'Read-only Wewed support view for governed Service Engagement payments, evidence holds and dispute trails.',
  robots: { index: false, follow: false },
}

export default function AdminTransactionGovernancePage() {
  return <SecureTransactionGovernance />
}
