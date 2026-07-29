'use client'

import { DashboardAuthGate } from '@/components/wedding/dashboard-auth-gate'
import { PlannerCollaborationHub } from '@/components/wedding/planner-collaboration-hub'
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
      description="Sign in to manage planning, collaboration, vendors, approvals, documents, guests, seating, reminders, templates, and assigned weddings."
      onClose={onClose}
    >
      <WeddingContextControls />
      <PlannerInvitationTools />
      <PlannerOperations />
      <PlannerCollaborationHub />
      <WeddingPlanner onClose={onClose} />
    </DashboardAuthGate>
  )
}
