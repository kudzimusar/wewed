const PHYSICAL_INVITATION_DESTINATION_PREFIX = 'print_'

export function normalizePhysicalInvitationCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export function formatPhysicalInvitationCode(value: string): string {
  const normalized = normalizePhysicalInvitationCode(value)
  if (normalized.length <= 5) return normalized
  return `${normalized.slice(0, 5)}-${normalized.slice(5, 10)}`
}

export function physicalInvitationDestinationId(code: string): string {
  const normalized = normalizePhysicalInvitationCode(code)
  return normalized ? `${PHYSICAL_INVITATION_DESTINATION_PREFIX}${normalized}` : ''
}

export function physicalInvitationCodeFromDestinationId(id: string): string | null {
  if (!id.startsWith(PHYSICAL_INVITATION_DESTINATION_PREFIX)) return null
  const code = normalizePhysicalInvitationCode(
    id.slice(PHYSICAL_INVITATION_DESTINATION_PREFIX.length),
  )
  return code || null
}
