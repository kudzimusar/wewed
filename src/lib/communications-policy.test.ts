import { describe, expect, it } from 'vitest'
import {
  canCreateCommunicationType,
  communicationMessagePolicy,
  defaultConversationTypeForRoles,
  normalizeCommunicationBody,
  normalizeParticipantIds,
} from '@/lib/communications-policy'

describe('communications policy', () => {
  it('allows ordinary users to message wedding peers and Wewed support only', () => {
    expect(canCreateCommunicationType('couple', 'DIRECT')).toBe(true)
    expect(canCreateCommunicationType('couple', 'PLANNER_CLIENT')).toBe(true)
    expect(canCreateCommunicationType('planner', 'WEDDING')).toBe(true)
    expect(canCreateCommunicationType('planner', 'SUPPORT')).toBe(true)
    expect(canCreateCommunicationType('couple', 'INTERNAL')).toBe(false)
    expect(canCreateCommunicationType('planner', 'BILLING')).toBe(false)
  })

  it('allows administrators to create operational conversation types', () => {
    expect(canCreateCommunicationType('admin', 'INTERNAL')).toBe(true)
    expect(canCreateCommunicationType('admin', 'OPERATIONS')).toBe(true)
    expect(canCreateCommunicationType('admin', 'BILLING')).toBe(true)
  })

  it('keeps internal notes staff-only', () => {
    expect(communicationMessagePolicy({ role: 'admin', internalNote: true })).toEqual({
      messageType: 'INTERNAL_NOTE',
      visibility: 'STAFF_ONLY',
    })
    expect(() => communicationMessagePolicy({ role: 'planner', internalNote: true }))
      .toThrow('Only Wewed administrators')
  })

  it('never accepts oversized messages', () => {
    expect(normalizeCommunicationBody('  hello  ')).toBe('hello')
    expect(() => normalizeCommunicationBody('x'.repeat(4001))).toThrow('4000 characters')
  })

  it('deduplicates participant ids and removes the actor', () => {
    expect(normalizeParticipantIds('actor', ['actor', 'b', 'b', '', 'c'])).toEqual(['b', 'c'])
  })

  it('chooses the correct default relationship type', () => {
    expect(defaultConversationTypeForRoles('planner', 'couple')).toBe('PLANNER_CLIENT')
    expect(defaultConversationTypeForRoles('couple', 'admin')).toBe('SUPPORT')
    expect(defaultConversationTypeForRoles('admin', 'admin')).toBe('INTERNAL')
    expect(defaultConversationTypeForRoles('planner', 'planner')).toBe('DIRECT')
  })
})
