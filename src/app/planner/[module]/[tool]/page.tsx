'use client'

import { useRouter } from 'next/navigation'
import { SecureWeddingPlanner } from '@/components/wedding/secure-wedding-planner'

export default function PlannerToolPage() {
  const router = useRouter()
  return <SecureWeddingPlanner onClose={() => router.push('/')} />
}
