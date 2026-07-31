'use client'

import { useRouter } from 'next/navigation'
import { SecureWewedAdmin } from '@/components/admin/secure-wewed-admin'

export default function WewedAdminPage() {
  const router = useRouter()
  return <SecureWewedAdmin onClose={() => router.push('/')} />
}
