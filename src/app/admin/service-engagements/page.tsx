import type { Metadata } from 'next'
import { SecureServiceEngagements } from '@/components/admin/secure-service-engagements'

export const metadata: Metadata = {
  title: 'Historical Service Records | Wewed Admin',
  description: 'Review and rescue governed historical vendor service records and private evidence.',
  robots: { index: false, follow: false },
}

export default function AdminServiceEngagementsPage() {
  return <SecureServiceEngagements />
}
