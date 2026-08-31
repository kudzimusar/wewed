import type { AiMessage } from '@/lib/ai'

export type WewedAiSkillId =
  | 'wedding_architect'
  | 'couple_coach'
  | 'planner_copilot'
  | 'marketplace_concierge'
  | 'booking_assistant'
  | 'vendor_copilot'
  | 'budget_analyst'
  | 'contributions_assistant'
  | 'contract_terms_explainer'
  | 'communications_copilot'
  | 'guest_concierge'
  | 'timeline_task_copilot'
  | 'admin_support_ai'
  | 'visual_design_director'

export type WewedAiAuthority =
  | 'explain'
  | 'suggest'
  | 'simulate'
  | 'draft'
  | 'prepare'
  | 'execute'

export type WewedAiDataProfile = 'public' | 'private' | 'anonymized'
export type WewedAiModelProfile = 'default_language' | 'reasoning'

export interface WewedAiContextEnvelope {
  traceId?: string
  actor: {
    userId?: string
    role: string
    permissions: string[]
  }
  wedding?: {
    id: string
    timezone?: string
    currency?: string
  }
  surface: {
    route: string
    entityType?: string
    entityId?: string
    intent?: string
  }
  dataProfile: WewedAiDataProfile
  facts: Record<string, unknown>
  evidence?: Array<{
    id: string
    title: string
    sourceUrl?: string
    visibility?: string
    excerpt?: string
  }>
  conversation?: AiMessage[]
  allowedTools?: string[]
  actionBoundary: WewedAiAuthority
}

export interface WewedAiRunRequest {
  skill: WewedAiSkillId
  outcome: string
  authority: WewedAiAuthority
  context: WewedAiContextEnvelope
  input: string
  maxOutputTokens?: number
}

export interface WewedAiRecommendation {
  title: string
  rationale?: string
  confidence?: 'low' | 'medium' | 'high'
  action?: string
}

export interface WewedAiQuestion {
  id?: string
  question: string
  reason?: string
  required?: boolean
}

export interface WewedAiActionProposal {
  type: string
  label: string
  payload?: Record<string, unknown>
  requiresConfirmation: true
}

export interface WewedAiOutcome {
  traceId: string
  skill: WewedAiSkillId
  outcome: string
  authority: WewedAiAuthority
  summary: string
  facts: Array<{ label: string; value: string; source?: string }>
  recommendations: WewedAiRecommendation[]
  missingInformation: WewedAiQuestion[]
  proposedActions: WewedAiActionProposal[]
  warnings: string[]
  provenance: {
    modelReleaseId: string
    promptReleaseId: string
    skillVersion: string
    provider: string
    model: string
    generatedAt: string
  }
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface WewedAiSkillDefinition {
  id: WewedAiSkillId
  version: string
  promptReleaseId: string
  modelProfile: WewedAiModelProfile
  allowedRoles: string[]
  allowedDataProfiles: WewedAiDataProfile[]
  allowedAuthorities: WewedAiAuthority[]
  outcomes: string[]
  allowedTools: string[]
  systemPrompt: string
  maxOutputTokens: number
}
