'use client'

import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { PlannerInvitationTools } from '@/components/wedding/planner-invitation-tools'
import { PlannerOperations } from '@/components/wedding/planner-operations'
import { WeddingContextControls } from '@/components/wedding/wedding-context-controls'
import { WeddingPlanner } from '@/components/wedding/wedding-planner'

interface SecureWeddingPlannerProps {
  onClose: () => void
}

export function SecureWeddingPlanner({ onClose }: SecureWeddingPlannerProps) {
  return (
    <DashboardAuthGate
      title="Wedding Planner"
      description="Sign in to manage the checklist, budget, vendors, guests, timeline, seating, reminders, templates, and assigned weddings."
      onClose={onClose}
    >
      <WeddingContextControls />
      <PlannerInvitationTools />
      <PlannerOperations />
      <WeddingPlanner onClose={onClose} />
    </DashboardAuthGate>
  )
}
