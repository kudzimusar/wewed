import { describe, expect, test } from 'bun:test'
import {
  calculateCollaborationMetrics,
  extractMentionEmails,
  isApprovalTransitionAllowed,
  normalizeCurrency,
  normalizeMoney,
  sanitizeExternalUrl,
} from './planner-phase3'

describe('Phase 3 collaboration helpers', () => {
  test('approval decisions can only be made from pending', () => {
    expect(isApprovalTransitionAllowed('pending', 'approved')).toBe(true)
    expect(isApprovalTransitionAllowed('pending', 'rejected')).toBe(true)
    expect(isApprovalTransitionAllowed('approved', 'rejected')).toBe(false)
    expect(isApprovalTransitionAllowed('cancelled', 'pending')).toBe(false)
  })

  test('mention extraction is unique and case-insensitive', () => {
    expect(
      extractMentionEmails(
        'Please ask @Planner@Example.com and @planner@example.com, then @owner@example.com.',
      ),
    ).toEqual(['planner@example.com', 'owner@example.com'])
  })

  test('money and currency inputs are normalized safely', () => {
    expect(normalizeMoney('1250.456')).toBe(1250.46)
    expect(normalizeMoney(-1)).toBeNull()
    expect(normalizeMoney('invalid')).toBeNull()
    expect(normalizeCurrency('usd')).toBe('USD')
    expect(normalizeCurrency('US')).toBe('USD')
  })

  test('external URLs only allow http and https', () => {
    expect(sanitizeExternalUrl('https://example.com/contract')).toBe(
      'https://example.com/contract',
    )
    expect(() => sanitizeExternalUrl('javascript:alert(1)')).toThrow()
    expect(() => sanitizeExternalUrl('', true)).toThrow()
  })

  test('collaboration metrics are scoped to the current user', () => {
    const now = new Date('2026-07-29T00:00:00.000Z')
    const metrics = calculateCollaborationMetrics({
      currentUserId: 'user-1',
      now,
      tasks: [
        { status: 'todo', dueDate: '2026-07-20T00:00:00.000Z', assigneeUserId: 'user-1' },
        { status: 'in_progress', dueDate: '2026-08-10T00:00:00.000Z', assigneeUserId: 'user-2' },
        { status: 'done', dueDate: '2026-07-01T00:00:00.000Z', assigneeUserId: 'user-1' },
      ],
      approvals: [
        { status: 'pending', reviewerUserId: 'user-1' },
        { status: 'pending', reviewerUserId: 'user-2' },
        { status: 'approved', reviewerUserId: 'user-1' },
      ],
      documents: [
        { status: 'active', expiresAt: '2026-08-05T00:00:00.000Z' },
        { status: 'archived', expiresAt: '2026-08-05T00:00:00.000Z' },
      ],
      notifications: [
        { status: 'unread', userId: 'user-1' },
        { status: 'read', userId: 'user-1' },
        { status: 'unread', userId: 'user-2' },
      ],
      vendors: [
        { pipelineStatus: 'booked' },
        { pipelineStatus: 'negotiating' },
      ],
    })

    expect(metrics).toEqual({
      openTasks: 2,
      myTasks: 1,
      overdueTasks: 1,
      pendingApprovals: 1,
      expiringDocuments: 1,
      unreadNotifications: 1,
      bookedVendors: 1,
      vendorsInPipeline: 1,
    })
  })
})
