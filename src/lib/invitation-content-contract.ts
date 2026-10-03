export const IVORY_INVITATION_COMPACT_LINE = 'We’d be honoured to celebrate with you.' as const

export type ChildrenPolicy = 'welcome' | 'adults_only'
export type AdditionalAdultPolicy = 'plus_ones_allowed' | 'named_guests_only'

export function normalizeAdditionalAdultPolicy(value: unknown): AdditionalAdultPolicy {
  return value === 'named_guests_only' ? 'named_guests_only' : 'plus_ones_allowed'
}

/**
 * Semantic invitation content shared by every client.
 *
 * This contract names concepts, not layout. A client may render them differently, but it must not
 * reinterpret one field as another. In particular, coupleNote is complete authored content and
 * must never be shortened to fit artwork; compactLine exists for that presentation purpose.
 */
export interface InvitationContentContract {
  compactLine: string
  coupleNote: string | null
  rsvpDeadline: string | Date | null
  childrenPolicy: ChildrenPolicy | null
  additionalAdultPolicy: AdditionalAdultPolicy | null
  participantType: string | null
  invitationVariant: string | null
}

export function normalizeCoupleNote(value: string | null | undefined): string | null {
  const note = value?.trim() ?? ''
  return note || null
}

export function ivoryInvitationContent(
  coupleNote: string | null | undefined,
): Pick<InvitationContentContract, 'compactLine' | 'coupleNote'> {
  return {
    compactLine: IVORY_INVITATION_COMPACT_LINE,
    coupleNote: normalizeCoupleNote(coupleNote),
  }
}
