'use client'

import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { WeddingContextControls } from '@/components/wedding/wedding-context-controls'
import { WeddingPlanner } from '@/components/wedding/wedding-planner'

interface SecureWeddingPlannerProps {
  onClose: () => void
}

export function SecureWeddingPlanner({ onClose }: SecureWeddingPlannerProps) {
  return (
    <DashboardAuthGate
      title="Wedding Planner"
      description="Sign in to manage the checklist, budget, vendors, guests, timeline, seating, and assigned weddings."
      onClose={onClose}
    >
      <WeddingContextControls />
      <WeddingPlanner onClose={onClose} />
    </DashboardAuthGate>
  )
}
