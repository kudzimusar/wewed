import type { Metadata } from 'next'
import { SecureClientOperations } from '@/components/admin/secure-client-operations'

const title = 'Client Systems and Billing | Wewed Admin'
const description =
  'Govern account-specific departments, systems, data points, resources, and segmented billing offers.'

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: false },
}

export default function AdminClientOperationsPage() {
  return <SecureClientOperations />
}
