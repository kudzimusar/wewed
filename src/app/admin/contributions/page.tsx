import type { Metadata } from 'next'
import { SecureAdminFinancialContributions } from '@/components/admin/secure-admin-financial-contributions'

export const metadata: Metadata = { title: 'Financial Contributions | Wewed Admin', description: 'Private Wewed resource-accounting analytics.', robots: { index: false, follow: false } }
export default function AdminFinancialContributionsPage() { return <SecureAdminFinancialContributions /> }
