import type { Metadata } from 'next'
import { SecureAccountBilling } from '@/components/billing/secure-account-billing'

export const metadata: Metadata = {
  title: 'Wewed Billing',
  description: 'Manage your Wewed subscription through Stripe Billing.',
  robots: { index: false, follow: false },
}

export default function BillingPage() {
  return <SecureAccountBilling />
}
