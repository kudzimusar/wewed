export const COMMUNICATION_CONVERSATION_TYPES = [
  'DIRECT',
  'WEDDING',
  'PLANNER_CLIENT',
  'MARKETPLACE',
  'SUPPORT',
  'INTERNAL',
  'OPERATIONS',
  'BILLING',
  'SYSTEM',
] as const

export type CommunicationConversationType = (typeof COMMUNICATION_CONVERSATION_TYPES)[number]
export type CommunicationActorRole = 'admin' | 'couple' | 'planner'
export type CommunicationMessageVisibility = 'PARTICIPANTS' | 'STAFF_ONLY'
export type CommunicationMessageType = 'USER' | 'INTERNAL_NOTE'

export const COMMUNICATION_MESSAGE_MAX_LENGTH = 4000
export const COMMUNICATION_MAX_PARTICIPANTS = 20

const ORDINARY_TYPES = new Set<CommunicationConversationType>([
  'DIRECT',
  'WEDDING',
  'PLANNER_CLIENT',
])
const ADMIN_TYPES = new Set<CommunicationConversationType>([
  ...COMMUNICATION_CONVERSATION_TYPES,
])

export function isCommunicationConversationType(
  value: unknown,
): value is CommunicationConversationType {
  return (
    typeof value === 'string' &&
    (COMMUNICATION_CONVERSATION_TYPES as readonly string[]).includes(value)
  )
}

export function canCreateCommunicationType(
  role: CommunicationActorRole,
  type: CommunicationConversationType,
): boolean {
  return role === 'admin' ? ADMIN_TYPES.has(type) : ORDINARY_TYPES.has(type)
}

export function communicationMessagePolicy(input: {
  role: CommunicationActorRole
  internalNote?: boolean
}): {
  messageType: CommunicationMessageType
  visibility: CommunicationMessageVisibility
} {
  if (input.internalNote) {
    if (input.role !== 'admin') {
      throw new Error('Only Wewed administrators can create internal notes.')
    }
    return { messageType: 'INTERNAL_NOTE', visibility: 'STAFF_ONLY' }
  }

  return { messageType: 'USER', visibility: 'PARTICIPANTS' }
}

export function normalizeCommunicationBody(value: unknown): string {
  if (typeof value !== 'string') return ''
  const body = value.trim()
  if (body.length > COMMUNICATION_MESSAGE_MAX_LENGTH) {
    throw new Error(
      `Message must be ${COMMUNICATION_MESSAGE_MAX_LENGTH} characters or fewer.`,
    )
  }
  return body
}

export function normalizeParticipantIds(
  actorUserId: string,
  value: unknown,
): string[] {
  if (!Array.isArray(value)) return []
  const unique = new Set<string>()
  for (const item of value) {
    if (typeof item !== 'string') continue
    const id = item.trim()
    if (id && id !== actorUserId) unique.add(id)
  }

  if (unique.size + 1 > COMMUNICATION_MAX_PARTICIPANTS) {
    throw new Error(
      `A conversation can contain at most ${COMMUNICATION_MAX_PARTICIPANTS} participants.`,
    )
  }

  return Array.from(unique)
}

export function defaultConversationTypeForRoles(
  actorRole: CommunicationActorRole,
  targetRole: CommunicationActorRole,
): CommunicationConversationType {
  if (actorRole === 'admin' && targetRole === 'admin') return 'INTERNAL'
  if (actorRole === 'admin' || targetRole === 'admin') return 'SUPPORT'
  if (
    (actorRole === 'planner' && targetRole === 'couple') ||
    (actorRole === 'couple' && targetRole === 'planner')
  ) {
    return 'PLANNER_CLIENT'
  }
  return 'DIRECT'
}
