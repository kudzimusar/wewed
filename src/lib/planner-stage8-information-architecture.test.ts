import { describe, expect, test } from 'bun:test'
import { KNOWN_ACTIVE_PARITY_GAPS } from './planner-parity-contract'

async function source(path: string): Promise<string> {
  return Bun.file(path).text()
}

function occurrences(value: string, marker: string): number {
  return value.split(marker).length - 1
}

describe('Stage 8 planner information architecture', () => {
  test('portal exposes one explicit daily navigation path with planning as the default view', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    for (const marker of [
      'function PlannerExperienceNavigation',
      'data-planner-experience-nav',
      'aria-label="Planner experience navigation"',
      'Plan → coordinate → update → operate → execute',
      'href="#planner-workspace"',
      'aria-current="page"',
      'Planning workspace',
      '<PlannerCollaborationHub />',
      '<PlannerClientProfile />',
      '<PlannerOperations />',
      '<PlannerInvitationTools />',
      '<PlannerEventCommand />',
      'id="planner-workspace"',
    ]) {
      expect(portal).toContain(marker)
    }

    for (const component of [
      '<PlannerCollaborationHub />',
      '<PlannerClientProfile />',
      '<PlannerOperations />',
      '<PlannerInvitationTools />',
      '<PlannerEventCommand />',
    ]) {
      expect(occurrences(portal, component)).toBe(1)
    }
  })

  test('legacy floating triggers are normalized inside a keyboard and mobile-safe disclosure', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    for (const marker of [
      'data-planner-tools-disclosure',
      'aria-expanded={toolsOpen}',
      'aria-controls="planner-experience-tools"',
      'grid gap-2 sm:grid-cols-2 xl:flex xl:min-w-max xl:items-center',
      'max-h-[42dvh]',
      'overflow-y-auto',
      'overscroll-contain',
      'data-planner-tool-triggers',
      '[data-planner-tool-triggers] > button',
      'position: static !important',
      'inset: auto !important',
      'box-shadow: none !important',
      'width: 100% !important',
      'justify-content: flex-start !important',
      '[data-planner-tool-triggers] > button span',
      'display: inline !important',
    ]) {
      expect(portal).toContain(marker)
    }
  })

  test('active-wedding changes remount the unified tools and the planning workspace', async () => {
    const portal = await source('src/components/wedding/planner-portal.tsx')

    expect(portal).toContain("window.addEventListener('wewed:wedding-switched', loadSession)")
    expect(portal).toContain("key={`tools-${wedding?.id ?? 'no-active-wedding'}`}")
    expect(portal).toContain("<PlannerWorkspace key={wedding?.id ?? 'no-active-wedding'} />")
    expect(portal).toContain('<WeddingContextControls />')
  })

  test('collaboration remains wedding-scoped and keeps all Phase 3 surfaces', async () => {
    const collaboration = await source('src/components/wedding/planner-collaboration-hub.tsx')

    for (const marker of [
      "fetch('/api/planner/collaboration'",
      "'upsert_vendor_pipeline'",
      "'create_approval'",
      "'decide_approval'",
      "'create_document'",
      "'create_comment'",
      'My Work',
      'Approvals',
      'Documents',
      'Discussion',
      'Notifications',
    ]) {
      expect(collaboration).toContain(marker)
    }
  })

  test('client, operations, invitations, and event command retain their existing APIs', async () => {
    const [profile, operations, invitations, invitationManager, eventCommand] = await Promise.all([
      source('src/components/wedding/planner-client-profile.tsx'),
      source('src/components/wedding/planner-operations.tsx'),
      source('src/components/wedding/planner-invitation-tools.tsx'),
      source('src/components/wedding/invitation-manager.tsx'),
      source('src/components/wedding/planner-event-command.tsx'),
    ])

    for (const marker of [
      "fetch('/api/planner/client-profile'",
      "method: 'PATCH'",
      "new CustomEvent('wewed:client-profile-updated')",
    ]) {
      expect(profile).toContain(marker)
    }

    for (const marker of [
      "fetch('/api/planner/overview'",
      "fetch('/api/planner/reminders'",
      "fetch('/api/planner/templates'",
      "fetch('/api/planner/seating/auto-assign'",
      'Reminders',
      'Templates',
      'Seating',
    ]) {
      expect(operations).toContain(marker)
    }

    for (const marker of [
      "fetch('/api/planner/invitations/summary'",
      "fetch('/api/planner/invitations/digital-cards'",
      "fetch('/api/planner/invitations/bulk'",
      'Invitation tools',
    ]) {
      expect(invitations).toContain(marker)
    }
    expect(invitationManager).toContain('InvitationManager')

    for (const marker of [
      "fetch('/api/planner/event-command'",
      'Event command',
    ]) {
      expect(eventCommand).toContain(marker)
    }
  })

  test('the Alpha tester daily workflow documents planning through event execution', async () => {
    const plan = await source('docs/planner/ALPHA_TESTER_DAILY_WORKFLOW.md')
    for (const marker of [
      'Planning workspace',
      'coordinate',
      'update',
      'operate',
      'execute',
      'close',
    ]) expect(plan.toLowerCase()).toContain(marker.toLowerCase())
  })

  test('zero original planner parity gaps remain', () => {
    expect([...KNOWN_ACTIVE_PARITY_GAPS]).toEqual([])
  })
})
