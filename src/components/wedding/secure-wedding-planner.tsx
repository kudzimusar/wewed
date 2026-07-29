'use client'

import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { WeddingPlanner } from '@/components/wedding/wedding-planner'

interface SecureWeddingPlannerProps {
  onClose: () => void
}

export function SecureWeddingPlanner({ onClose }: SecureWeddingPlannerProps) {
  return (
    <DashboardAuthGate
      title="Wedding Planner"
      description="Sign in to manage the checklist, budget, vendors, guests, timeline, and seating."
      onClose={onClose}
    >
      <WeddingPlanner onClose={onClose} />
    </DashboardAuthGate>
  )
}
