import type { Metadata } from 'next'
import { ProviderProfileManager } from '@/components/providers/provider-profile-manager'

export const metadata: Metadata = {
  title: 'Manage Provider Profile | Wewed',
  description: 'Sign in with an approved venue or vendor account to maintain its public Wewed profile.',
  robots: { index: false, follow: false },
}

export default function ManageProviderProfilePage() {
  return <ProviderProfileManager />
}
