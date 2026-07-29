'use client'

import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { PlannerPortal } from '@/components/wedding/planner-portal'

interface SecureWeddingPlannerProps {
  onClose: () => void
}

export function SecureWeddingPlanner({ onClose }: SecureWeddingPlannerProps) {
  return (
    <DashboardAuthGate
      title="Wewed Planner Workspace"
      description="Sign in as an assigned planner, coordinator, owner, or approved team member."
      onClose={onClose}
    >
      <PlannerPortal onExit={onClose} />
    </DashboardAuthGate>
  )
}
