'use client'

import { useRouter } from 'next/navigation'
import { SecureWeddingPlanner } from '@/components/wedding/secure-wedding-planner'

export default function PlannerModulePage() {
  const router = useRouter()
  return <SecureWeddingPlanner onClose={() => router.push('/')} />
}
